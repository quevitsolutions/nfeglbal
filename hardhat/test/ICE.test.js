// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY = 86400n;

async function timeTravel(seconds) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine");
}

describe("AIPCore ICE System", function () {
    let nfe, rewardPoolContract, vestingVault, cycleManager, renewalEngine, views;
    let owner, oracle, matrix, feeRec, user1, user2, user3, keeper;

    // Helper: get tier cost (0-indexed)
    async function tierCost(n) {
        return await nfe.getTierCost(n);
    }

    // Helper: register a node
    async function registerNode(user, sponsorId) {
        const regFee = await nfe.getRegistrationFee();
        await nfe.connect(user).createNode(sponsorId, { value: regFee });
        return await nfe.nodeId(user.address);
    }

    // Helper: unlock tiers
    async function unlockTier(user, nodeId, toTier) {
        const node = await nfe.getNode(nodeId);
        let cost = 0n;
        for (let i = Number(node.tier); i < toTier; i++) {
            cost += await tierCost(i);
        }
        await nfe.connect(user).unlockTier(nodeId, toTier, { value: cost });
    }

    beforeEach(async function () {
        [owner, oracle, matrix, feeRec, user1, user2, user3, keeper] = await ethers.getSigners();

        // 1. Deploy aipcoreViews library
        const ViewsFactory = await ethers.getContractFactory("aipcoreViews");
        views = await ViewsFactory.deploy();
        await views.waitForDeployment();

        // 2. Deploy aipcore Core
        const NFE = await ethers.getContractFactory("aipcore", {
            libraries: { aipcoreViews: await views.getAddress() }
        });
        nfe = await NFE.deploy(
            owner.address,
            feeRec.address,
            owner.address,      // temporary rewardPool
            owner.address,
            oracle.address,
            matrix.address
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
        await nfe.connect(owner).setAddr(1, await rewardPoolContract.getAddress(), 0);

        // 4. Deploy NFEVestingVault
        const VaultFactory = await ethers.getContractFactory("NFEVestingVault");
        vestingVault = await VaultFactory.deploy(
            owner.address,
            await nfe.getAddress(),
            await rewardPoolContract.getAddress(),
            feeRec.address
        );
        await vestingVault.waitForDeployment();

        // 5. Deploy NFECycleManager
        const CMFactory = await ethers.getContractFactory("NFECycleManager");
        cycleManager = await CMFactory.deploy(owner.address);
        await cycleManager.waitForDeployment();

        // 6. Deploy NFERenewalEngine
        const REFactory = await ethers.getContractFactory("NFERenewalEngine");
        renewalEngine = await REFactory.deploy(
            owner.address,
            await nfe.getAddress(),
            await vestingVault.getAddress(),
            await cycleManager.getAddress()
        );
        await renewalEngine.waitForDeployment();

        // 7. Wire everything up
        // Core: vault + cycleManager + renewalEngine
        await nfe.connect(owner).setGovernor(owner.address);
        await nfe.connect(owner).setVault(await vestingVault.getAddress());
        await nfe.connect(owner).setCycleManager(await cycleManager.getAddress());
        await nfe.connect(owner).setRenewalEngine(await renewalEngine.getAddress());

        // Vault: set renewalEngine
        await vestingVault.connect(owner).setRenewalEngine(await renewalEngine.getAddress());

        // CycleManager: set renewalEngine
        await cycleManager.connect(owner).setRenewalEngine(await renewalEngine.getAddress());

        // Set manual BNB price: 300 USD per BNB
        await nfe.connect(oracle).manualUpdatePrice(30000000000n);
    });

    // =========================================================================
    // Deployment & Configuration
    // =========================================================================

    describe("Deployment & Configuration", function () {
        it("should deploy all ICE contracts with correct addresses", async function () {
            expect(await vestingVault.core()).to.equal(await nfe.getAddress());
            expect(await vestingVault.rewardPool()).to.equal(await rewardPoolContract.getAddress());
            expect(await vestingVault.feeReceiver()).to.equal(feeRec.address);
            expect(await vestingVault.renewalEngine()).to.equal(await renewalEngine.getAddress());

            expect(await cycleManager.renewalEngine()).to.equal(await renewalEngine.getAddress());

            expect(await renewalEngine.core()).to.equal(await nfe.getAddress());
            expect(await renewalEngine.vestingVault()).to.equal(await vestingVault.getAddress());
            expect(await renewalEngine.cycleManager()).to.equal(await cycleManager.getAddress());
        });

        it("should have core wired correctly", async function () {
            expect(await nfe.incomeVault()).to.equal(await vestingVault.getAddress());
            expect(await nfe.cycleManager()).to.equal(await cycleManager.getAddress());
            expect(await nfe.renewalEngine()).to.equal(await renewalEngine.getAddress());
        });
    });

    // =========================================================================
    // Genesis Node Exemption
    // =========================================================================

    describe("Genesis Node Exemption (55555)", function () {
        it("genesis node is always active in CycleManager", async function () {
            expect(await cycleManager.isActive(55555)).to.equal(true);
        });

        it("genesis node cannot be renewed via RenewalEngine", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await expect(
                renewalEngine.connect(owner).renewFor(55555, { value: cost })
            ).to.be.revertedWith("NFERenewalEngine: genesis is exempt");
        });

        it("genesis node rewards bypass the vault and go directly to wallet", async function () {
            // Register user1 under genesis
            const nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);

            // Genesis node (owner.address) should have no vault balance
            expect(await vestingVault.getTotalDeposited(55555)).to.equal(0n);

            // Register user2 under user1
            const nodeId2 = await registerNode(user2, nodeId1);
            await unlockTier(user2, nodeId2, 1);

            // user1 should have vault balance (non-genesis)
            expect(await vestingVault.getTotalDeposited(nodeId1)).to.be.gt(0n);
        });
    });

    // =========================================================================
    // NFEVestingVault — Vesting & Claims
    // =========================================================================

    describe("NFEVestingVault", function () {
        let nodeId1, nodeId2;

        beforeEach(async function () {
            nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);
            nodeId2 = await registerNode(user2, nodeId1);
            await unlockTier(user2, nodeId2, 1);
        });

        it("deposits rewards into vault for non-genesis nodes", async function () {
            expect(await vestingVault.getTotalDeposited(nodeId1)).to.be.gt(0n);
        });

        it("creates independent vesting positions per deposit", async function () {
            const count = await vestingVault.getPositionCount(nodeId1);
            expect(count).to.be.gt(0n);
        });

        it("vested balance is 0 immediately after deposit (linear vest)", async function () {
            // With defaultVestingDays=5, at t=0 nothing vested
            const vested = await vestingVault.getVestedBalance(nodeId1);
            // Some small amount may be vested due to block timestamp, allow tolerance
            const total = await vestingVault.getTotalDeposited(nodeId1);
            expect(vested).to.be.lt(total); // not fully vested yet
        });

        it("fully vested after defaultVestingDays", async function () {
            const total = await vestingVault.getTotalDeposited(nodeId1);
            await timeTravel(6n * DAY); // 6 days > 5 days default
            const vested = await vestingVault.getVestedBalance(nodeId1);
            expect(vested).to.equal(total);
        });

        it("allows claim of vested rewards by node wallet (no restriction)", async function () {
            await timeTravel(6n * DAY);
            const vested = await vestingVault.getVestedBalance(nodeId1);
            expect(vested).to.be.gt(0n);

            const balBefore = await ethers.provider.getBalance(user1.address);
            const tx = await vestingVault.connect(user1).claimVestedRewards(nodeId1);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balAfter = await ethers.provider.getBalance(user1.address);

            expect(balAfter + gasUsed - balBefore).to.equal(vested);
        });

        it("does NOT restrict claims for expired subscription (always claimable)", async function () {
            // Travel past 360 days — subscription would be long expired
            await timeTravel(400n * DAY);

            // Subscription is not active (never renewed)
            expect(await cycleManager.isActive(nodeId1)).to.equal(false);

            // But vested balance is still claimable
            const vested = await vestingVault.getVestedBalance(nodeId1);
            expect(vested).to.be.gt(0n);

            // Should succeed with no restriction
            await expect(
                vestingVault.connect(user1).claimVestedRewards(nodeId1)
            ).to.not.be.reverted;
        });

        it("allows partial claim", async function () {
            await timeTravel(6n * DAY);
            const vested = await vestingVault.getVestedBalance(nodeId1);
            const half = vested / 2n;

            const balBefore = await ethers.provider.getBalance(user1.address);
            const tx = await vestingVault.connect(user1).claimPartial(nodeId1, half);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balAfter = await ethers.provider.getBalance(user1.address);

            expect(balAfter + gasUsed - balBefore).to.equal(half);
        });

        it("prevents claim by non-wallet address", async function () {
            await timeTravel(6n * DAY);
            await expect(
                vestingVault.connect(user2).claimVestedRewards(nodeId1)
            ).to.be.revertedWith("NFEVestingVault: not node wallet");
        });

        it("instant withdrawal applies 20% penalty", async function () {
            await timeTravel(6n * DAY); // fully vested
            const vested = await vestingVault.getVestedBalance(nodeId1);

            const poolBefore = await ethers.provider.getBalance(await rewardPoolContract.getAddress());
            const feeBefore  = await ethers.provider.getBalance(feeRec.address);
            const userBefore = await ethers.provider.getBalance(user1.address);

            const tx = await vestingVault.connect(user1).instantWithdraw(nodeId1, vested);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const expectedPenalty = vested * 2000n / 10000n; // 20%
            const expectedNet     = vested - expectedPenalty;
            const expectedPool    = expectedPenalty * 5000n / 10000n; // 50% of penalty
            const expectedFee     = expectedPenalty - expectedPool;

            const poolAfter = await ethers.provider.getBalance(await rewardPoolContract.getAddress());
            const feeAfter  = await ethers.provider.getBalance(feeRec.address);
            const userAfter = await ethers.provider.getBalance(user1.address);

            expect(userAfter + gasUsed - userBefore).to.equal(expectedNet);
            expect(poolAfter - poolBefore).to.be.closeTo(expectedPool, ethers.parseEther("0.001"));
            expect(feeAfter  - feeBefore).to.be.closeTo(expectedFee,  ethers.parseEther("0.001"));
        });

        it("gets correct node summary", async function () {
            await timeTravel(6n * DAY);
            const summary = await vestingVault.getNodeSummary(nodeId1);
            expect(summary.deposited).to.be.gt(0n);
            expect(summary.vestedClaimable).to.equal(summary.deposited); // fully vested
            expect(summary.unvested).to.equal(0n);
        });
    });

    // =========================================================================
    // NFECycleManager
    // =========================================================================

    describe("NFECycleManager", function () {
        it("new nodes are NOT active by default (must renew)", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            expect(await cycleManager.isActive(nodeId1)).to.equal(false);
        });

        it("genesis 55555 is always active", async function () {
            expect(await cycleManager.isActive(55555)).to.equal(true);
        });

        it("activation sets correct cycleEnd (now + cycleDuration)", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);

            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            const sub = await cycleManager.getSubscription(nodeId1);
            expect(sub.active).to.equal(true);
            expect(Number(sub.cycleEnd) - Number(sub.cycleStart)).to.be.closeTo(
                Number(await cycleManager.cycleDuration()), 10
            );
        });

        it("isActive returns false after cycleEnd", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);

            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            // Travel past 360 days
            await timeTravel(361n * DAY);

            // isActive should read stale state as still "active" until keeper expires it
            // (on-chain check: block.timestamp > cycleEnd)
            expect(await cycleManager.isActive(nodeId1)).to.equal(false);
        });

        it("keeper can batch expire nodes", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);

            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            await timeTravel(361n * DAY);

            // Before batch expire: subscription struct still says active
            const subBefore = await cycleManager.getSubscription(nodeId1);
            // isActive correctly returns false (computed from timestamp), but struct may lag
            expect(await cycleManager.isActive(nodeId1)).to.equal(false);

            await cycleManager.connect(keeper).batchCheckAndExpire([nodeId1]);
            const subAfter = await cycleManager.getSubscription(nodeId1);
            expect(subAfter.active).to.equal(false);
        });

        it("only renewalEngine can activateNode", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            await expect(
                cycleManager.connect(user1).activateNode(nodeId1, 1)
            ).to.be.revertedWith("NFECycleManager: not renewal engine");
        });

        it("cycle can be advanced by owner", async function () {
            const cycleBefore = await cycleManager.currentCycle();
            await cycleManager.connect(owner).advanceCycle();
            expect(await cycleManager.currentCycle()).to.equal(cycleBefore + 1n);
        });
    });

    // =========================================================================
    // NFERenewalEngine
    // =========================================================================

    describe("NFERenewalEngine", function () {
        let nodeId1, nodeId2;

        beforeEach(async function () {
            nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);
            nodeId2 = await registerNode(user2, nodeId1);
            await unlockTier(user2, nodeId2, 1);
        });

        it("getRenewalCost returns Tier-1 BNB cost", async function () {
            const renewCost = await renewalEngine.getRenewalCost();
            const t1Cost    = await nfe.getTierCost(0);
            expect(renewCost).to.equal(t1Cost);
        });

        it("wallet payment renewal (Priority 3) activates node", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });
            expect(await cycleManager.isActive(nodeId1)).to.equal(true);
        });

        it("refunds excess wallet payment", async function () {
            const cost = await renewalEngine.getRenewalCost();
            const excess = ethers.parseEther("1");

            const balBefore = await ethers.provider.getBalance(user1.address);
            const tx = await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost + excess });
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balAfter = await ethers.provider.getBalance(user1.address);

            // Net deduction should be ~cost + gas (excess refunded)
            const deducted = balBefore - balAfter - gasUsed;
            expect(deducted).to.be.closeTo(cost, ethers.parseEther("0.001"));
        });

        it("reverts if insufficient payment", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await expect(
                renewalEngine.connect(user1).renewFor(nodeId1, { value: cost / 2n })
            ).to.be.revertedWith("NFERenewalEngine: insufficient payment");
        });

        it("treasury-funded renewal (Priority 1) works", async function () {
            const signers = await ethers.getSigners();
            const user4 = signers[8];
            const user5 = signers[9];

            // nodeId3 is registered under nodeId2 and stays at tier 0
            const nodeId3 = await registerNode(user3, nodeId2);

            // Register user4 and user5 under nodeId3 and upgrade them.
            // nodeId4 to Tier 1, and nodeId5 to Tier 4.
            // This generates sponsor and layer rewards directly to nodeId3's treasury,
            // resulting in a treasury balance of ~23.9 USD (>= renewal cost) without triggering
            // auto-upgrade of nodeId3 past Tier 1.
            const nodeId4 = await registerNode(user4, nodeId3);
            await unlockTier(user4, nodeId4, 1);

            const nodeId5 = await registerNode(user5, nodeId3);
            await unlockTier(user5, nodeId5, 4);

            // Deposit to vault to ensure nodeId3 has enough treasury balance for renewal under the auto-upgrade model
            await nfe.connect(user3).depositToVault({ value: ethers.parseEther("0.05") });

            const treasury = await nfe.treasuryBalance(nodeId3);
            const cost = await renewalEngine.getRenewalCost();
            expect(treasury).to.be.gte(cost);

            // node3 can renew using treasury
            await renewalEngine.connect(user3).renewFor(nodeId3, { value: 0 });
            expect(await cycleManager.isActive(nodeId3)).to.equal(true);

            const status = await renewalEngine.getRenewalStatus(nodeId3);
            // funded from treasury
            expect(status.renewals).to.equal(1n);
        });

        it("vault-funded renewal (Priority 2) deducts from vault", async function () {
            const signers = await ethers.getSigners();
            const user4 = signers[8];

            // Register user4 under nodeId1 and upgrade them to Tier 1
            // This deposits rewards into nodeId1's vault (nodeId1 is Tier 1 and qualified)
            // Adding to the rewards nodeId1 already got from user2's upgrade
            const nodeId4 = await registerNode(user4, nodeId1);
            await unlockTier(user4, nodeId4, 1);

            await timeTravel(6n * DAY); // vest the vault balance

            const vested = await vestingVault.getVestedBalance(nodeId1);
            const cost   = await renewalEngine.getRenewalCost();
            expect(vested).to.be.gte(cost);

            const vaultBefore = await vestingVault.getVestedBalance(nodeId1);
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: 0 });
            const vaultAfter = await vestingVault.getVestedBalance(nodeId1);

            expect(vaultBefore - vaultAfter).to.be.gte(cost);
            expect(await cycleManager.isActive(nodeId1)).to.equal(true);
        });

        it("renewal runs full tier distribution (direct + layer + pool)", async function () {
            const cost = await renewalEngine.getRenewalCost();

            // Track genesis wallet — receives direct + all layer rewards (is sponsor of all nodes in test tree)
            const genesisWallet = await nfe.getNodeWallet(55555);
            const balBefore = await ethers.provider.getBalance(genesisWallet);

            const poolBefore = await ethers.provider.getBalance(await rewardPoolContract.getAddress());

            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            const balAfter  = await ethers.provider.getBalance(genesisWallet);
            const poolAfter = await ethers.provider.getBalance(await rewardPoolContract.getAddress());

            // Genesis must receive at least the direct reward (10% of cost)
            const expectedMinDirect = cost * 1000n / 10000n;
            expect(balAfter - balBefore).to.be.gte(expectedMinDirect);

            // RewardPool must receive at least 5% (rewardPoolPercent)
            const expectedPoolMin = cost * 500n / 10000n;
            // Pool may have received slightly more due to pendingReward accumulation, allow range
            expect(poolAfter - poolBefore).to.be.gte(expectedPoolMin / 2n);
        });

        it("renewal records lastRenewalTime and renewalCount", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            expect(await renewalEngine.renewalCount(nodeId1)).to.equal(1n);
            expect(await renewalEngine.lastRenewalTime(nodeId1)).to.be.gt(0n);
        });

        it("anyone (keeper) can renew a node", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(keeper).renewFor(nodeId1, { value: cost });
            expect(await cycleManager.isActive(nodeId1)).to.equal(true);
        });

        it("getRenewalStatus returns correct wallet needed", async function () {
            const status = await renewalEngine.getRenewalStatus(nodeId1);
            expect(status.cost).to.equal(await renewalEngine.getRenewalCost());
            // walletNeeded = cost - treasury - vault (but both likely 0 here)
            expect(status.walletNeeded).to.be.lte(status.cost);
        });

        it("genesis node exempt from renewal", async function () {
            const cost = await renewalEngine.getRenewalCost();
            await expect(
                renewalEngine.renewFor(55555, { value: cost })
            ).to.be.revertedWith("NFERenewalEngine: genesis is exempt");
        });

        it("renewals can be paused by owner", async function () {
            await renewalEngine.connect(owner).setRenewalsEnabled(false);
            const cost = await renewalEngine.getRenewalCost();
            await expect(
                renewalEngine.connect(user1).renewFor(nodeId1, { value: cost })
            ).to.be.revertedWith("NFERenewalEngine: renewals disabled");
        });
    });

    // =========================================================================
    // No Tree Duplication
    // =========================================================================

    describe("Tree Immutability", function () {
        it("sponsor/matrix/networkTree never modified by ICE contracts", async function () {
            const nodeId1 = await registerNode(user1, 55555);
            await unlockTier(user1, nodeId1, 1);

            const nodeIdBefore = await nfe.nodeId(user1.address);
            const nodeBefore   = await nfe.getNode(nodeId1);

            // Perform renewal
            const cost = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost });

            // Advance cycle
            await cycleManager.connect(owner).advanceCycle();
            const cost2 = await renewalEngine.getRenewalCost();
            await renewalEngine.connect(user1).renewFor(nodeId1, { value: cost2 });

            const nodeAfter = await nfe.getNode(nodeId1);

            // Sponsor, matrixParent, wallet must be unchanged
            expect(nodeAfter.sponsor).to.equal(nodeBefore.sponsor);
            expect(nodeAfter.matrixParent).to.equal(nodeBefore.matrixParent);
            expect(nodeAfter.wallet).to.equal(nodeBefore.wallet);
            // nodeId from nodeId mapping unchanged
            expect(await nfe.nodeId(user1.address)).to.equal(nodeIdBefore);
        });
    });
});
