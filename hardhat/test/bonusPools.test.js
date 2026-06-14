const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY = 86400n;

async function timeTravel(seconds) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine");
}

describe("NFE V3 Bonus Pools & Leaderboards", function () {
    let nfe, rewardPoolContract, leadership, founderPool, leaderboardPool, views;
    let owner, oracle, matrix, feeRec, user1, user2, sponsor1, childNodes = [];

    beforeEach(async function () {
        [owner, oracle, matrix, feeRec, user1, user2, sponsor1, ...childNodes] = await ethers.getSigners();

        // 1. Deploy nfeglobalViews library
        const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
        views = await ViewsFactory.deploy();
        await views.waitForDeployment();

        // 2. Deploy nfeglobal Core
        const NFE = await ethers.getContractFactory("nfeglobal", {
            libraries: { nfeglobalViews: await views.getAddress() }
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

        // 2.5 Deploy NFEGlobalViewsContract
        const NFEGlobalViewsContractFactory = await ethers.getContractFactory("NFEGlobalViewsContract");
        const viewsContract = await NFEGlobalViewsContractFactory.deploy();
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

        // Link rewardPool in Core
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

        // Link leadership in RewardPool
        await rewardPoolContract.connect(owner).setLeadershipEngine(await leadership.getAddress());

        // 5. Deploy FounderPool
        const FounderPoolFactory = await ethers.getContractFactory("FounderPool");
        founderPool = await FounderPoolFactory.deploy(
            await nfe.getAddress(),
            await rewardPoolContract.getAddress(),
            feeRec.address
        );
        await founderPool.waitForDeployment();

        // 6. Deploy LeaderboardPool
        const LeaderboardPoolFactory = await ethers.getContractFactory("LeaderboardPool");
        leaderboardPool = await LeaderboardPoolFactory.deploy(
            await nfe.getAddress(),
            await leadership.getAddress(),
            feeRec.address
        );
        await leaderboardPool.waitForDeployment();

        // 7. Link new pools in Core and Leadership contracts
        await nfe.connect(owner).setFounderPool(await founderPool.getAddress());
        await nfe.connect(owner).setLeaderboardPool(await leaderboardPool.getAddress());

        await leadership.connect(owner).setFounderPool(await founderPool.getAddress());
        await leadership.connect(owner).setLeaderboardPool(await leaderboardPool.getAddress());

        // Set manual BNB price (e.g. 300 USD per BNB)
        await nfe.connect(oracle).manualUpdatePrice(30000000000n);
    });

    describe("Starter Founder Pool (Pool 1)", function () {
        it("should qualify user who activates Tier 1 on the same day", async function () {
            const regFee = await nfe.getRegistrationFee();
            
            // Register user1 under genesis node (55555)
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            
            // Activate Tier 1
            const t1Cost = await nfe.getUpgradeCost(0, 1);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: t1Cost });

            // Verify they are qualified as Starter Founder (Pool 1)
            expect(await founderPool.isQualified(user1NodeId, 1)).to.equal(true);
            expect(await founderPool.poolMembers(1)).to.equal(1n);

            // Fund the pool by sending BNB to RewardPoolLeadership
            await owner.sendTransaction({
                to: await leadership.getAddress(),
                value: ethers.parseEther("4.0") // 4 BNB total = 1 BNB to FounderPool = 0.2 BNB to Pool 1
            });

            // Pending reward should be t1Cost (due to cap)
            const pending = await founderPool.getPendingRewards(user1NodeId, 1);
            expect(pending).to.equal(t1Cost);

            // Claim rewards
            const initialBal = await ethers.provider.getBalance(user1.address);
            await founderPool.connect(user1).claim(user1NodeId, 1);
            const finalBal = await ethers.provider.getBalance(user1.address);
            expect(finalBal).to.be.greaterThan(initialBal);

            // Cap checks: Starter Founder cap is Tier 1 cost.
            // Tier 1 cost = $5 / 300 = 0.01666 BNB. 0.2 BNB exceeds this, so they should be capped and auto-exited.
            expect(await founderPool.isQualified(user1NodeId, 1)).to.equal(false);
            expect(await founderPool.poolMembers(1)).to.equal(0n);
        });
    });

    describe("Fast Activator Pool (Pool 2)", function () {
        it("should qualify user who upgrades to Tier 5 within 24 hours", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user2).createNode(55555, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);

            // Upgrade user2 sequentially to Tier 5
            let totalCost = 0n;
            for (let i = 1; i <= 5; i++) {
                totalCost += await nfe.getUpgradeCost(0, i);
            }

            await nfe.connect(user2).unlockTier(user2NodeId, 5, { value: totalCost });

            // Verify they are qualified as Fast Activator (Pool 2)
            expect(await founderPool.isQualified(user2NodeId, 2)).to.equal(true);
            expect(await founderPool.poolMembers(2)).to.equal(1n);
        });
    });

    describe("Starter Builder Pool (Pool 3)", function () {
        it("should qualify user who refers 10 Starter Founders in 30 days, cap at 1x T0 cost per referral, and allow re-entry on new referral", async function () {
            const regFee = await nfe.getRegistrationFee();
            const t0Cost = await nfe.getUpgradeCost(0, 1);

            // Register sponsor1 under genesis (55555)
            await nfe.connect(sponsor1).createNode(55555, { value: regFee });
            const sponsorId = await nfe.nodeId(sponsor1.address);

            // Refer 10 Starter Founders under sponsor1
            for (let i = 0; i < 10; i++) {
                const childSigner = childNodes[i];
                await nfe.connect(childSigner).createNode(sponsorId, { value: regFee });
                const cid = await nfe.nodeId(childSigner.address);
                await nfe.connect(childSigner).unlockTier(cid, 1, { value: t0Cost });
            }

            // Verify qualified for Pool 3
            expect(await founderPool.isQualified(sponsorId, 3)).to.equal(true);
            expect(await founderPool.poolMembers(3)).to.equal(1n);

            // Cap should be 10 * t0Cost
            const expectedCap1 = 10n * t0Cost;
            expect(await founderPool.getPoolCap(sponsorId, 3)).to.equal(expectedCap1);

            // Fund the pool by sending BNB to RewardPoolLeadership
            await owner.sendTransaction({
                to: await leadership.getAddress(),
                value: ethers.parseEther("200.0") // 200 BNB -> 50 BNB to FounderPool -> 10 BNB to Pool 3
            });

            // Pending reward should be capped at 10 * t0Cost
            const pending = await founderPool.getPendingRewards(sponsorId, 3);
            expect(pending).to.equal(expectedCap1);

            // Claim rewards
            await founderPool.connect(sponsor1).claim(sponsorId, 3);

            // Should be capped and auto-exited
            expect(await founderPool.isQualified(sponsorId, 3)).to.equal(false);
            expect(await founderPool.poolMembers(3)).to.equal(0n);

            // Now refer 11th Starter Founder to increase the cap and reactivate
            const childSigner11 = childNodes[10];
            await nfe.connect(childSigner11).createNode(sponsorId, { value: regFee });
            const cid11 = await nfe.nodeId(childSigner11.address);
            await nfe.connect(childSigner11).unlockTier(cid11, 1, { value: t0Cost });

            // Verify they qualified again
            expect(await founderPool.isQualified(sponsorId, 3)).to.equal(true);
            expect(await founderPool.poolMembers(3)).to.equal(1n);

            // New cap should be 11 * t0Cost
            const expectedCap2 = 11n * t0Cost;
            expect(await founderPool.getPoolCap(sponsorId, 3)).to.equal(expectedCap2);

            // Claimable should be the 1x T0 cost difference (since we claimed 10 * t0Cost and cap is 11 * t0Cost)
            const pending2 = await founderPool.getPendingRewards(sponsorId, 3);
            expect(pending2).to.equal(t0Cost);
        });
    });

    describe("Leaderboard Pool & Points Tracking", function () {
        it("should record points for personal upgrades and sort leaderboards", async function () {
            await rewardPoolContract.connect(owner).setPoolTierThreshold("BRONZE_TIER", 1);
            await rewardPoolContract.connect(owner).setPoolDirectReq("BRONZE_DIRECT", 0);
            await rewardPoolContract.connect(owner).setPoolTeamReq("BRONZE_TEAM", 0);

            const regFee = await nfe.getRegistrationFee();
            
            // Register sponsor1 and make them Founder rank
            await nfe.connect(sponsor1).createNode(55555, { value: regFee });
            const sponsorId = await nfe.nodeId(sponsor1.address);

            // Register 10 referrals under sponsor1 to promote sponsor1 to Founder rank
            // Each referral needs manually registerNode since they are Tier 1 (mocking)
            for (let i = 0; i < 10; i++) {
                const signer = childNodes[i];
                await nfe.connect(signer).createNode(sponsorId, { value: regFee });
                const cid = await nfe.nodeId(signer.address);
                await nfe.connect(signer).unlockTier(cid, 1, { value: await nfe.getUpgradeCost(0, 1) });
                // Register in RewardPool
                await rewardPoolContract.connect(signer).registerNode(cid);
            }

            // Verify sponsor1 is Founder rank (rank 1)
            expect(await leadership.rank(sponsorId)).to.equal(1);

            // Upgrade sponsor1 to Tier 2 (since they were auto-upgraded to Tier 1)
            const t2Cost = await nfe.getUpgradeCost(1, 2);
            await nfe.connect(sponsor1).unlockTier(sponsorId, 2, { value: t2Cost });

            // Verify score in leaderboard
            const score = await leaderboardPool.scores(sponsorId, 1);
            expect(score).to.be.greaterThan(0n);

            // Check leaderboard board view
            const board = await leaderboardPool.getBoard(1);
            expect(board[0].nodeId).to.equal(sponsorId);
            expect(board[0].score).to.equal(score);
        });
    });
});
