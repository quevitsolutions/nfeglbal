const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY = 86400n;

async function timeTravel(seconds) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine");
}

describe("NFE V3 IncomeVaultHelper Integration", function () {
    let nfe, rewardPoolContract, vault, views;
    let owner, oracle, matrix, feeRec, user1, user2, user3;

    beforeEach(async function () {
        [owner, oracle, matrix, feeRec, user1, user2, user3] = await ethers.getSigners();

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

        // 4. Deploy IncomeVaultHelper
        const VaultFactory = await ethers.getContractFactory("IncomeVaultHelper");
        vault = await VaultFactory.deploy(
            await nfe.getAddress(),
            await rewardPoolContract.getAddress(),
            feeRec.address
        );
        await vault.waitForDeployment();

        // 5. Connect Vault to Core and RewardPool
        await nfe.connect(owner).setVault(await vault.getAddress());
        await rewardPoolContract.connect(owner).setVault(await vault.getAddress());

        // 6. Set manual BNB price (e.g. 300 USD per BNB, which is 300e8)
        await nfe.connect(oracle).manualUpdatePrice(30000000000n); // 300 USD
    });

    describe("Deployment & Configuration", function () {
        it("sets correct core, rewardPool and feeReceiver addresses", async function () {
            expect(await vault.core()).to.equal(await nfe.getAddress());
            expect(await vault.rewardPool()).to.equal(await rewardPoolContract.getAddress());
            expect(await vault.feeReceiver()).to.equal(feeRec.address);
        });

        it("sets correct vault in core and rewardPool", async function () {
            expect(await nfe.incomeVault()).to.equal(await vault.getAddress());
            expect(await rewardPoolContract.incomeVault()).to.equal(await vault.getAddress());
        });

        it("reverts on setVault by unauthorized caller", async function () {
            await expect(
                nfe.connect(user1).setVault(user1.address)
            ).to.be.reverted;

            await expect(
                rewardPoolContract.connect(user1).setVault(user1.address)
            ).to.be.reverted;
        });
    });

    describe("Genesis Node Exemption", function () {
        it("routes genesis node (55555) rewards directly to wallet, bypassing the vault", async function () {
            const regFee = await nfe.getRegistrationFee();
            
            // Register user1
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            
            // Activate Tier 1 for user1
            const t1Cost = await nfe.getUpgradeCost(0, 1);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: t1Cost });
            
            // Verify owner's direct rewards were paid to their wallet, and nothing deposited to vault for 55555
            expect(await vault.getTotalVaultBalance(55555)).to.equal(0n);
            
            // Let's register user2 with sponsor user1
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            
            const vaultBalBefore = await vault.getTotalVaultBalance(user1NodeId);
            expect(vaultBalBefore).to.equal(0n);
            
            // Unlock Tier 1 for user2 -> generates sponsor reward for user1
            await nfe.connect(user2).unlockTier(user2NodeId, 1, { value: t1Cost });
            
            const vaultBalAfter = await vault.getTotalVaultBalance(user1NodeId);
            expect(vaultBalAfter).to.be.gt(0n); // user1 rewards routed to vault
        });
    });

    describe("Vesting Schedule & Linear Release", function () {
        it("calculates correct vesting schedule based on tier", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            
            // Unlock Tier 3 for user1 (Tier 3 -> 10 days release)
            const t3Cost = await nfe.getUpgradeCost(0, 3);
            await nfe.connect(user1).unlockTier(user1NodeId, 3, { value: t3Cost });
            
            // Let's register user2 under user1 to generate a reward
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            
            const t1Cost = await nfe.getUpgradeCost(0, 1);
            await nfe.connect(user2).unlockTier(user2NodeId, 1, { value: t1Cost });
            
            // Verify a deposit is created in the vault for user1
            const count = await vault.getDepositCount(user1NodeId);
            expect(count).to.be.gt(0n);
            
            let totalAmt = 0n;
            for (let i = 0n; i < count; i++) {
                const dep = await vault.getDepositInfo(user1NodeId, i);
                expect(dep.releaseDays).to.equal(10n); // Tier 3 -> (3-1)*5 = 10 days
                totalAmt += dep.amount;
            }
            
            // Linear release checks
            // Initially, claimable should be 0 (since elapsed time is near 0)
            expect(await vault.getClaimable(user1NodeId)).to.equal(0n);
            
            // Travel 5 days (halfway through vesting)
            await timeTravel(5n * 24n * 3600n);
            
            const claimableHalf = await vault.getClaimable(user1NodeId);
            expect(claimableHalf).to.be.closeTo(totalAmt / 2n, ethers.parseEther("0.001"));
            
            // Travel to the end of vesting (10 days total)
            await timeTravel(5n * 24n * 3600n);
            expect(await vault.getClaimable(user1NodeId)).to.equal(totalAmt);
        });
    });

    describe("Claims & Reinvestment", function () {
        it("allows claims of vested rewards with 0% fee", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            await nfe.connect(user2).unlockTier(user2NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            // Move time past 5 days (Tier 1 -> 5 days vesting)
            await timeTravel(5n * DAY + 1n);
            
            const claimable = await vault.getClaimable(user1NodeId);
            expect(claimable).to.be.gt(0n);
            
            const balBefore = await ethers.provider.getBalance(user1.address);
            const tx = await vault.connect(user1).claim();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            
            const balAfter = await ethers.provider.getBalance(user1.address);
            expect(balAfter + gasUsed - balBefore).to.equal(claimable);
            expect(await vault.getClaimable(user1NodeId)).to.equal(0n);
        });

        it("allows reinvesting vested rewards for upgrades", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            // Let's generate a large reward for user1 so they can afford upgrading to tier 2
            // Let's make user2 purchase higher tiers
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            
            const costUpTo6 = await nfe.getUpgradeCost(0, 6);
            await nfe.connect(user2).unlockTier(user2NodeId, 6, { value: costUpTo6 });
            
            // Move time past 5 days so user1's reward is fully vested
            await timeTravel(5n * DAY + 1n);
            
            const vested = await vault.getClaimable(user1NodeId);
            const upgradeCost = await nfe.getUpgradeCost(1, 2);
            expect(vested).to.be.gt(upgradeCost);
            
            // Reinvest to Tier 2
            await vault.connect(user1).reinvest(2, upgradeCost);
            
            // Verify user1's tier is now 2 in core contract
            const userStats = await nfe.getNodeStats(user1NodeId);
            expect(userStats.tier).to.equal(2n);
        });
    });

    describe("Instant Withdrawal & Penalties", function () {
        it("allows instant withdrawal with a 20% penalty split (80% to RewardPool, 20% to FeeReceiver)", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            await nfe.connect(user2).unlockTier(user2NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            // Verify there is a locked/vested deposit
            const locked = await vault.getLockedBalance(user1NodeId);
            expect(locked).to.be.gt(0n);
            
            const totalVaultBal = await vault.getTotalVaultBalance(user1NodeId);
            
            // Perform instant withdrawal of the entire balance
            const poolBalBefore = await ethers.provider.getBalance(await rewardPoolContract.getAddress());
            const feeRecBalBefore = await ethers.provider.getBalance(feeRec.address);
            const userBalBefore = await ethers.provider.getBalance(user1.address);
            
            const tx = await vault.connect(user1).instantWithdraw(totalVaultBal);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            
            // Calculations
            const expectedPenalty = totalVaultBal * 20n / 100n;
            const expectedNetPayout = totalVaultBal - expectedPenalty;
            const expectedPoolAmt = expectedPenalty * 80n / 100n;
            const expectedFeeAmt = expectedPenalty - expectedPoolAmt;
            
            const userBalAfter = await ethers.provider.getBalance(user1.address);
            const poolBalAfter = await ethers.provider.getBalance(await rewardPoolContract.getAddress());
            const feeRecBalAfter = await ethers.provider.getBalance(feeRec.address);
            
            expect(userBalAfter + gasUsed - userBalBefore).to.equal(expectedNetPayout);
            expect(poolBalAfter - poolBalBefore).to.equal(expectedPoolAmt);
            expect(feeRecBalAfter - feeRecBalBefore).to.equal(expectedFeeAmt);
            
            // Vault balance should now be 0
            expect(await vault.getTotalVaultBalance(user1NodeId)).to.equal(0n);
        });
    });

    describe("Circuit Breaker & Pausability", function () {
        it("prevents claims, deposits, reinvestments, and instant withdrawals when paused", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const user1NodeId = await nfe.nodeId(user1.address);
            await nfe.connect(user1).unlockTier(user1NodeId, 1, { value: await nfe.getUpgradeCost(0, 1) });
            
            await vault.connect(owner).pauseVault();
            expect(await vault.paused()).to.equal(true);
            
            // Try to deposit -> should divert
            await nfe.connect(user2).createNode(user1NodeId, { value: regFee });
            const user2NodeId = await nfe.nodeId(user2.address);
            
            const t1Cost = await nfe.getUpgradeCost(0, 1);
            await nfe.connect(user2).unlockTier(user2NodeId, 1, { value: t1Cost });
            
            // Verify no new vault deposit is created
            expect(await vault.getDepositCount(user1NodeId)).to.equal(0n);
            // Verify it went to pendingReward instead
            expect(await nfe.pendingReward(user1.address)).to.be.gt(0n);
            
            // Reinvest/withdraw/claim directly in vault should revert
            await expect(vault.connect(user1).claim()).to.be.revertedWith("Vault is paused");
            await expect(vault.connect(user1).reinvest(2, 100n)).to.be.revertedWith("Vault is paused");
            await expect(vault.connect(user1).instantWithdraw(100n)).to.be.revertedWith("Vault is paused");
        });
    });
});
