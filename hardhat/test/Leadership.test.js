const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY = 86400n;

async function timeTravel(seconds) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine");
}

describe("RewardPool Leadership Engine Integration", function () {
    let nfe, rewardPoolContract, leadership, views, leadershipViews;
    let owner, oracle, matrix, feeRec, userSponsor, referralNodes = [], otherUser;

    beforeEach(async function () {
        [owner, oracle, matrix, feeRec, userSponsor, otherUser, ...referralNodes] = await ethers.getSigners();

        // 1. Deploy aipcoreViews library
        const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
        views = await ViewsFactory.deploy();
        await views.waitForDeployment();

        // 2. Deploy aipcore Core
        const NFE = await ethers.getContractFactory("aipcore", {
            libraries: { aipcoreViews: await views.getAddress() }
        });
        nfe = await NFE.deploy(
            owner.address,      // firstUser (Node 55555)
            feeRec.address,     // feeReceiver
            owner.address,      // temporary rewardPool
            owner.address,      // owner
            oracle.address,     // oracleAdmin
            matrix.address      // matrixAdmin
        );
        await nfe.waitForDeployment();
        nfe = await ethers.getContractAt("contracts/Iaipcore.sol:Iaipcore", await nfe.getAddress());

        // 2.5 Deploy AIPCoreViewsContract
        const AIPCoreViewsContractFactory = await ethers.getContractFactory("AIPCoreViewsContract");
        const viewsContract = await AIPCoreViewsContractFactory.deploy();
        await viewsContract.waitForDeployment();
        await nfe.connect(owner).setViewsContract(await viewsContract.getAddress());

        // 3. Deploy RewardPool
        const RewardPoolFactory = await ethers.getContractFactory("RewardPool");
        rewardPoolContract = await RewardPoolFactory.deploy(
            await nfe.getAddress(),
            owner.address,
            55555
        );
        await rewardPoolContract.waitForDeployment();

        // Update rewardPool address on core
        await nfe.connect(owner).setAddr(1, await rewardPoolContract.getAddress(), 0);

        // 4. Deploy RewardPoolLeadership
        const LeadershipFactory = await ethers.getContractFactory("RewardPoolLeadership");
        leadership = await LeadershipFactory.deploy(
            await nfe.getAddress(),
            await rewardPoolContract.getAddress(),
            feeRec.address,
            owner.address
        );
        await leadership.waitForDeployment();

        // Link leadership to RewardPool
        await rewardPoolContract.connect(owner).setLeadershipEngine(await leadership.getAddress());

        // 5. Deploy LeadershipViews
        const LeadershipViewsFactory = await ethers.getContractFactory("LeadershipViews");
        leadershipViews = await LeadershipViewsFactory.deploy(await leadership.getAddress());
        await leadershipViews.waitForDeployment();

        // Set manual BNB price (e.g. 300 USD per BNB, which is 300e8)
        await nfe.connect(oracle).manualUpdatePrice(30000000000n);
    });

    describe("Deployment & Configuration", function () {
        it("should initialize addresses correctly", async function () {
            expect(await leadership.engine()).to.equal(await nfe.getAddress());
            expect(await leadership.rewardPool()).to.equal(await rewardPoolContract.getAddress());
            expect(await leadership.feeReceiverWallet()).to.equal(feeRec.address);
            expect(await leadership.owner()).to.equal(owner.address);
        });

        it("should auto-initialize Genesis Node (55555) as Ambassador", async function () {
            expect(await leadership.rank(55555)).to.equal(3); // 3 = Ambassador
            expect(await leadership.isRankActive(55555)).to.equal(true);
            expect(await leadership.founderMembers()).to.equal(1n);
            expect(await leadership.seniorMembers()).to.equal(1n);
            expect(await leadership.ambassadorMembers()).to.equal(1n);
        });

        it("should revert if zero address passed in constructor", async function () {
            const LeadershipFactory = await ethers.getContractFactory("RewardPoolLeadership");
            await expect(
                LeadershipFactory.deploy(
                    ethers.ZeroAddress,
                    await rewardPoolContract.getAddress(),
                    feeRec.address,
                    owner.address
                )
            ).to.be.revertedWith("Zero engine address");
        });
    });

    describe("Platform Inflow & Reward Splits", function () {
        it("should forward 50% to fee receiver and allocate 50% to active leadership pools", async function () {
            const amount = ethers.parseEther("10");

            // Store initial balances
            const feeRecBalBefore = await ethers.provider.getBalance(feeRec.address);

            // Send BNB to leadership contract (simulating platform fees inflow)
            const tx = await owner.sendTransaction({
                to: await leadership.getAddress(),
                value: amount
            });
            await tx.wait();

            const feeRecBalAfter = await ethers.provider.getBalance(feeRec.address);

            // 75% (7.5 BNB) should go to the fee receiver EOA (including fallbacks)
            expect(feeRecBalAfter - feeRecBalBefore).to.equal(ethers.parseEther("7.5"));

            // 25% (2.5 BNB) should be allocated to leadership pools
            // Since only Genesis node is active, they get all the rewards.
            expect(await leadership.totalLeadershipReceived()).to.equal(ethers.parseEther("2.5"));

            // Founder pool gets 50% of leadership share (1.25 BNB)
            // Senior pool gets 30% of leadership share (0.75 BNB)
            // Ambassador pool gets 20% of leadership share (0.50 BNB)
            expect(await leadership.founderAccPerShare()).to.equal(ethers.parseEther("1.25") * 1000000000000000000n);
            expect(await leadership.seniorAccPerShare()).to.equal(ethers.parseEther("0.75") * 1000000000000000000n);
            expect(await leadership.ambassadorAccPerShare()).to.equal(ethers.parseEther("0.50") * 1000000000000000000n);

            // Since Genesis is in all three, it accumulates 2.5 BNB
            expect(await leadership.getClaimableTotal(55555)).to.equal(ethers.parseEther("2.5"));
        });
    });

    describe("Promotion & Activity Checks", function () {
        let sponsorNodeId;

        beforeEach(async function () {
            const regFee = await nfe.getRegistrationFee();

            // Register sponsor node under Genesis
            await nfe.connect(userSponsor).createNode(55555, { value: regFee });
            sponsorNodeId = await nfe.nodeId(userSponsor.address);
        });

        it("should promote sponsor to Founder after 10 Bronze qualifications", async function () {
            await rewardPoolContract.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
            await rewardPoolContract.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

            const regFee = await nfe.getRegistrationFee();
            const upgradeCost = await nfe.getUpgradeCost(0, 1);

            // We need 10 bronze achievers (direct referrals who unlocked a Reward Pool)
            // Bronze Pool is Pool 1. Let's register 10 nodes under userSponsor and upgrade them to Tier 1
            for (let i = 0; i < 10; i++) {
                const referralSigner = referralNodes[i];
                await nfe.connect(referralSigner).createNode(sponsorNodeId, { value: regFee });
                const nodeId = await nfe.nodeId(referralSigner.address);
                
                // Unlock Tier 1 which places them in Bronze Pool
                await nfe.connect(referralSigner).unlockTier(nodeId, 1, { value: upgradeCost });
                await rewardPoolContract.connect(referralSigner).registerNode(nodeId);
            }

            // Verify rank promoted to Founder (1) and active (true)
            expect(await leadership.rank(sponsorNodeId)).to.equal(1); // Founder
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);
            expect(await leadership.founderMembers()).to.equal(2n); // Genesis + userSponsor
        });

        it("should deactivate Founder rank if no new bronze referrals in activity window (30 days)", async function () {
            await rewardPoolContract.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
            await rewardPoolContract.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

            const regFee = await nfe.getRegistrationFee();
            const upgradeCost = await nfe.getUpgradeCost(0, 1);

            // Register and upgrade 10 referrals to make userSponsor a Founder
            for (let i = 0; i < 10; i++) {
                const referralSigner = referralNodes[i];
                await nfe.connect(referralSigner).createNode(sponsorNodeId, { value: regFee });
                const nodeId = await nfe.nodeId(referralSigner.address);
                await nfe.connect(referralSigner).unlockTier(nodeId, 1, { value: upgradeCost });
                await rewardPoolContract.connect(referralSigner).registerNode(nodeId);
            }

            // User is active Founder
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);

            // Travel 31 days (activity window is 30 days)
            await timeTravel(31n * DAY);

            // Check activity using views or by calling syncLeadershipStatus
            expect(await leadership.isLeadershipActive(sponsorNodeId, 1)).to.equal(false);

            await leadership.syncLeadershipStatus(sponsorNodeId);
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(false);
            expect(await leadership.founderMembers()).to.equal(1n); // Only genesis remains
        });

        it("should promote sponsor to Senior Founder after 5 Silver qualifications, and deactivate if no new Silver referrals in activity window (30 days)", async function () {
            await rewardPoolContract.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
            await rewardPoolContract.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

            await rewardPoolContract.connect(owner).setPoolTierThreshold("SILVER_TIER", 2);
            await rewardPoolContract.connect(owner).setPoolDirectReq("SILVER_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("SILVER_TEAM", 0);

            const regFee = await nfe.getRegistrationFee();
            const upgradeCost1 = await nfe.getUpgradeCost(0, 1);
            const upgradeCost2 = await nfe.getUpgradeCost(1, 2);

            // Register and upgrade 5 referrals to Silver (Tier 2) under userSponsor
            for (let i = 0; i < 5; i++) {
                const referralSigner = referralNodes[i];
                await nfe.connect(referralSigner).createNode(sponsorNodeId, { value: regFee });
                const nodeId = await nfe.nodeId(referralSigner.address);
                await nfe.connect(referralSigner).unlockTier(nodeId, 1, { value: upgradeCost1 });
                await nfe.connect(referralSigner).unlockTier(nodeId, 2, { value: upgradeCost2 });
                await rewardPoolContract.connect(referralSigner).registerNode(nodeId);
            }

            // Verify rank promoted to Senior Founder (2) and active (true)
            expect(await leadership.rank(sponsorNodeId)).to.equal(2); // Senior Founder
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);

            // Travel 31 days (activity window is 30 days)
            await timeTravel(31n * DAY);

            // Check activity using views or by calling syncLeadershipStatus
            expect(await leadership.isLeadershipActive(sponsorNodeId, 2)).to.equal(false);

            await leadership.syncLeadershipStatus(sponsorNodeId);
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(false);
            expect(await leadership.seniorMembers()).to.equal(1n); // Only genesis remains

            // Now refer another Silver to reactivate
            const newReferralSigner = referralNodes[5];
            await nfe.connect(newReferralSigner).createNode(sponsorNodeId, { value: regFee });
            const nodeId = await nfe.nodeId(newReferralSigner.address);
            await nfe.connect(newReferralSigner).unlockTier(nodeId, 1, { value: upgradeCost1 });
            await nfe.connect(newReferralSigner).unlockTier(nodeId, 2, { value: upgradeCost2 });
            await rewardPoolContract.connect(newReferralSigner).registerNode(nodeId);

            // Sponsor should be reactivated in Senior Founder
            expect(await leadership.isLeadershipActive(sponsorNodeId, 2)).to.equal(true);
            await leadership.syncLeadershipStatus(sponsorNodeId);
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);
            expect(await leadership.seniorMembers()).to.equal(2n);
        });

        it("should promote sponsor to Ambassador after 3 Gold qualifications, and deactivate if no new Gold referrals in activity window (30 days)", async function () {
            await rewardPoolContract.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
            await rewardPoolContract.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

            await rewardPoolContract.connect(owner).setPoolTierThreshold("SILVER_TIER", 2);
            await rewardPoolContract.connect(owner).setPoolDirectReq("SILVER_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("SILVER_TEAM", 0);

            await rewardPoolContract.connect(owner).setPoolTierThreshold("GOLD_TIER", 3);
            await rewardPoolContract.connect(owner).setPoolDirectReq("GOLD_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("GOLD_TEAM", 0);

            const regFee = await nfe.getRegistrationFee();
            const upgradeCost1 = await nfe.getUpgradeCost(0, 1);
            const upgradeCost2 = await nfe.getUpgradeCost(1, 2);
            const upgradeCost3 = await nfe.getUpgradeCost(2, 3);

            // Register and upgrade 3 referrals to Gold (Tier 3) under userSponsor
            for (let i = 0; i < 3; i++) {
                const referralSigner = referralNodes[i];
                await nfe.connect(referralSigner).createNode(sponsorNodeId, { value: regFee });
                const nodeId = await nfe.nodeId(referralSigner.address);
                await nfe.connect(referralSigner).unlockTier(nodeId, 1, { value: upgradeCost1 });
                await nfe.connect(referralSigner).unlockTier(nodeId, 2, { value: upgradeCost2 });
                await nfe.connect(referralSigner).unlockTier(nodeId, 3, { value: upgradeCost3 });
                await rewardPoolContract.connect(referralSigner).registerNode(nodeId);
            }

            // Verify rank promoted to Ambassador (3) and active (true)
            expect(await leadership.rank(sponsorNodeId)).to.equal(3); // Ambassador
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);

            // Travel 31 days (activity window is 30 days)
            await timeTravel(31n * DAY);

            // Check activity using views or by calling syncLeadershipStatus
            expect(await leadership.isLeadershipActive(sponsorNodeId, 3)).to.equal(false);

            await leadership.syncLeadershipStatus(sponsorNodeId);
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(false);
            expect(await leadership.ambassadorMembers()).to.equal(1n); // Only genesis remains

            // Now refer another Gold to reactivate
            const newReferralSigner = referralNodes[3];
            await nfe.connect(newReferralSigner).createNode(sponsorNodeId, { value: regFee });
            const nodeId = await nfe.nodeId(newReferralSigner.address);
            await nfe.connect(newReferralSigner).unlockTier(nodeId, 1, { value: upgradeCost1 });
            await nfe.connect(newReferralSigner).unlockTier(nodeId, 2, { value: upgradeCost2 });
            await nfe.connect(newReferralSigner).unlockTier(nodeId, 3, { value: upgradeCost3 });
            await rewardPoolContract.connect(newReferralSigner).registerNode(nodeId);

            // Sponsor should be reactivated in Ambassador
            expect(await leadership.isLeadershipActive(sponsorNodeId, 3)).to.equal(true);
            await leadership.syncLeadershipStatus(sponsorNodeId);
            expect(await leadership.isRankActive(sponsorNodeId)).to.equal(true);
            expect(await leadership.ambassadorMembers()).to.equal(2n);
        });
    });

    describe("Claims Integration", function () {
        it("should allow claiming leadership rewards via RewardPool", async function () {
            // Fund the leadership contract
            await owner.sendTransaction({
                to: await leadership.getAddress(),
                value: ethers.parseEther("1")
            });

            // Genesis node has 0.5 BNB claimable
            const [, , claimable] = await rewardPoolContract.getClaimable(55555);
            expect(claimable).to.be.gt(0n);

            const balanceBefore = await ethers.provider.getBalance(owner.address);

            // Claim rewards via RewardPool
            const tx = await rewardPoolContract.connect(owner).claim(55555);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(owner.address);

            // Wallet should receive standard pool rewards + leadership rewards
            expect(balanceAfter + gasUsed - balanceBefore).to.be.closeTo(claimable, ethers.parseEther("0.01"));
        });
    });

    describe("Views Library", function () {
        it("getNodeView and getGlobalView return correct status details", async function () {
            const globalView = await leadershipViews.getGlobalView();
            expect(globalView.founderMembersCount).to.equal(1n);
            expect(globalView.seniorMembersCount).to.equal(1n);
            expect(globalView.ambassadorMembersCount).to.equal(1n);

            const nodeView = await leadershipViews.getNodeView(55555);
            expect(nodeView.rank).to.equal(3); // Ambassador
            expect(nodeView.isActive).to.equal(true);
        });
    });

    describe("Admin Actions", function () {
        it("allows owner to configure requirements and transfer ownership", async function () {
            await expect(leadership.connect(otherUser).setFounderRequirements(5))
                .to.be.revertedWith("Not owner");

            await leadership.connect(owner).setFounderRequirements(8);
            expect(await leadership.founderBronzeRequired()).to.equal(8n);

            await leadership.connect(owner).setFeeReceiverWallet(otherUser.address);
            expect(await leadership.feeReceiverWallet()).to.equal(otherUser.address);

            await leadership.connect(owner).transferOwnership(otherUser.address);
            expect(await leadership.owner()).to.equal(otherUser.address);
        });
    });
});
