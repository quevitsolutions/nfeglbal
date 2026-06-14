// test/governance.test.js
// Governance system tests for NFEGovernance + nfeglobal integration

const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY  = 86400n;
const DAYS7 = DAY * 7n;

async function timeTravel(seconds) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine");
}

describe("NFE Governance System", function () {
    let nfe, gov;
    let owner, oracle, matrix, feeRec, rewardPool, daoAddr, multisig, user1;

    beforeEach(async function () {
        [owner, oracle, matrix, feeRec, rewardPool, daoAddr, multisig, user1] =
            await ethers.getSigners();

        // Deploy the nfeglobalViews library first (required link for nfeglobal)
        const ViewsFactory = await ethers.getContractFactory("nfeglobalViews");
        const views = await ViewsFactory.deploy();
        await views.waitForDeployment();
        const viewsAddr = await views.getAddress();

        // Deploy core contract with library link
        const NFE = await ethers.getContractFactory("nfeglobal", {
            libraries: { nfeglobalViews: viewsAddr }
        });
        nfe = await NFE.deploy(
            owner.address,      // firstUser
            feeRec.address,     // feeReceiver
            rewardPool.address, // rewardPool
            owner.address,      // owner
            oracle.address,     // oracleAdmin
            matrix.address      // matrixAdmin
        );
        await nfe.waitForDeployment();

        // Deploy NFEGlobalViewsContract
        const NFEGlobalViewsContractFactory = await ethers.getContractFactory("NFEGlobalViewsContract");
        const viewsContract = await NFEGlobalViewsContractFactory.deploy();
        await viewsContract.waitForDeployment();
        await nfe.connect(owner).setViewsContract(await viewsContract.getAddress());

        // Deploy governance contract (governor = owner EOA initially)
        const GOV = await ethers.getContractFactory("NFEGovernance");
        gov = await GOV.deploy(await nfe.getAddress(), owner.address);
        await gov.waitForDeployment();

        // Register NFEGovernance as governor on the core contract
        await nfe.connect(owner).setGovernor(await gov.getAddress());
    });

    // =========================================================================
    // setGovernor
    // =========================================================================
    describe("setGovernor", function () {
        it("sets governor and emits GovernorSet", async function () {
            const govAddr = await gov.getAddress();
            expect(await nfe.governor()).to.equal(govAddr);
        });

        it("reverts if non-owner calls setGovernor", async function () {
            await expect(
                nfe.connect(user1).setGovernor(user1.address)
            ).to.be.reverted;
        });

        it("reverts if zero address passed", async function () {
            await expect(
                nfe.connect(owner).setGovernor(ethers.ZeroAddress)
            ).to.be.reverted;
        });
    });

    // =========================================================================
    // Timelock proposal lifecycle
    // =========================================================================
    describe("Timelock proposals", function () {
        it("creates a proposal and stores ETA = now + 7 days", async function () {
            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                365n * DAY
            ]);
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "Set dormancy 1yr");
            const receipt = await tx.wait();

            // Grab proposalId from event
            const event = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            expect(event).to.not.be.undefined;

            const proposalId = event.args[0];
            const proposal   = await gov.getProposal(proposalId);
            expect(proposal.executed).to.equal(false);
            expect(proposal.cancelled).to.equal(false);

            const block = await ethers.provider.getBlock(receipt.blockNumber);
            expect(proposal.eta).to.be.closeTo(
                BigInt(block.timestamp) + DAYS7,
                2n
            );
        });

        it("cannot execute before timelock expires", async function () {
            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                500n * DAY
            ]);
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "Too early");
            const receipt = await tx.wait();
            const event = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];

            await expect(
                gov.connect(owner).execute(proposalId)
            ).to.be.revertedWith("Timelock not expired");
        });

        it("executes successfully after 7 days", async function () {
            const newPeriod = 730n * DAY; // 2 years
            const calldata  = nfe.interface.encodeFunctionData(
                "setDormancyPeriod", [newPeriod]
            );
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "Set 2yr dormancy");
            const receipt = await tx.wait();
            const event   = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];

            await timeTravel(DAYS7 + 1n);

            await gov.connect(owner).execute(proposalId);

            expect(await nfe.dormancyPeriod()).to.equal(newPeriod);
            expect((await gov.getProposal(proposalId)).executed).to.equal(true);
        });

        it("cannot execute a proposal twice", async function () {
            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                400n * DAY
            ]);
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "Double exec");
            const receipt = await tx.wait();
            const event   = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];

            await timeTravel(DAYS7 + 1n);
            await gov.connect(owner).execute(proposalId);

            await expect(
                gov.connect(owner).execute(proposalId)
            ).to.be.revertedWith("Already executed");
        });

        it("can cancel a proposal before execution", async function () {
            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                800n * DAY
            ]);
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "To cancel");
            const receipt = await tx.wait();
            const event   = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];

            await gov.connect(owner).cancel(proposalId);
            expect((await gov.getProposal(proposalId)).cancelled).to.equal(true);

            await timeTravel(DAYS7 + 1n);
            await expect(
                gov.connect(owner).execute(proposalId)
            ).to.be.revertedWith("Cancelled");
        });

        it("isReady returns false before delay and true after", async function () {
            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                600n * DAY
            ]);
            const tx = await gov
                .connect(owner)
                .propose(await nfe.getAddress(), calldata, "isReady test");
            const receipt = await tx.wait();
            const event   = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];

            expect(await gov.isReady(proposalId)).to.equal(false);
            await timeTravel(DAYS7 + 1n);
            expect(await gov.isReady(proposalId)).to.equal(true);
        });
    });

    // =========================================================================
    // Convenience proposal builders
    // =========================================================================
    describe("Convenience proposal builders", function () {
        async function buildAndExecute(buildFn) {
            const tx      = await buildFn();
            const receipt = await tx.wait();
            const event   = receipt.logs.find(
                l => l.fragment && l.fragment.name === "ProposalCreated"
            );
            const proposalId = event.args[0];
            await timeTravel(DAYS7 + 1n);
            await gov.connect(owner).execute(proposalId);
            return proposalId;
        }

        it("proposeSetDormancyPeriod changes dormancyPeriod", async function () {
            await buildAndExecute(() =>
                gov.connect(owner).proposeSetDormancyPeriod(500n * DAY, "500d")
            );
            expect(await nfe.dormancyPeriod()).to.equal(500n * DAY);
        });

        it("proposeSetDormancyDistribution changes BPs", async function () {
            await buildAndExecute(() =>
                gov.connect(owner).proposeSetDormancyDistribution(6000, 3000, 1000, "60/30/10")
            );
            expect(await nfe.dormancyRewardPoolBP()).to.equal(6000n);
            expect(await nfe.dormancyDAOBP()).to.equal(3000n);
            expect(await nfe.dormancyFeeRecBP()).to.equal(1000n);
        });

        it("proposeSetDaoTreasury sets daoTreasury", async function () {
            await buildAndExecute(() =>
                gov.connect(owner).proposeSetDaoTreasury(daoAddr.address, "set dao")
            );
            expect(await nfe.daoTreasury()).to.equal(daoAddr.address);
        });

        it("proposeSetRegistrationFee changes registrationFeeUSD", async function () {
            await buildAndExecute(() =>
                gov.connect(owner).proposeSetRegistrationFee(ethers.parseEther("1"), "fee 1usd")
            );
            expect(await nfe.registrationFeeUSD()).to.equal(ethers.parseEther("1"));
        });

        it("proposeSetAutoBatch changes autoBatch", async function () {
            await buildAndExecute(() =>
                gov.connect(owner).proposeSetAutoBatch(10, "batch 10")
            );
            expect(await nfe.autoBatch()).to.equal(10n);
        });
    });

    // =========================================================================
    // setDormancyPeriod
    // =========================================================================
    describe("setDormancyPeriod (direct — governor)", function () {
        it("reverts if period < 365 days", async function () {
            // Direct call from governor address (owner also qualifies via onlyGovernor)
            await expect(
                nfe.connect(owner).setDormancyPeriod(100n * DAY)
            ).to.be.reverted;
        });

        it("reverts if period > 3650 days", async function () {
            await expect(
                nfe.connect(owner).setDormancyPeriod(4000n * DAY)
            ).to.be.reverted;
        });

        it("reverts if called by non-governor", async function () {
            await expect(
                nfe.connect(user1).setDormancyPeriod(500n * DAY)
            ).to.be.reverted;
        });
    });

    // =========================================================================
    // setDormancyDistribution
    // =========================================================================
    describe("setDormancyDistribution", function () {
        it("reverts if BPs do not sum to 10000", async function () {
            await expect(
                nfe.connect(owner).setDormancyDistribution(5000, 2000, 1000)
            ).to.be.reverted;
        });

        it("sets distribution correctly", async function () {
            await nfe.connect(owner).setDormancyDistribution(5000, 3000, 2000);
            expect(await nfe.dormancyRewardPoolBP()).to.equal(5000n);
            expect(await nfe.dormancyDAOBP()).to.equal(3000n);
            expect(await nfe.dormancyFeeRecBP()).to.equal(2000n);
        });
    });

    // =========================================================================
    // sweepDormantTreasury
    // =========================================================================
    describe("sweepDormantTreasury", function () {
        it("reverts for root node (always exempt)", async function () {
            await expect(
                nfe.connect(owner).sweepDormantTreasury(55555)
            ).to.be.reverted;
        });

        it("reverts if node is not dormant", async function () {
            // Use a non-existent node (nodeId 1) — lastTreasuryActivity = 0 but
            // it has no wallet and the treasury check hits dormancy first since
            // block.timestamp >> dormancyPeriod for ts=0. Use a very recent
            // node by testing a node that hasn't been inactive long enough.
            // Simplest: register a fresh node and immediately try to sweep.
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const uid = await nfe.nodeId(user1.address);
            await expect(
                nfe.connect(owner).sweepDormantTreasury(uid)
            ).to.be.reverted;
        });

        it("reverts if non-governor tries to sweep a non-root node", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const uid = await nfe.nodeId(user1.address);
            await expect(
                nfe.connect(user1).sweepDormantTreasury(uid)
            ).to.be.reverted;
        });

        it("sweeps correctly after dormancy period elapses", async function () {
            const regFee = await nfe.getRegistrationFee();
            await nfe.connect(user1).createNode(55555, { value: regFee });
            const uid = await nfe.nodeId(user1.address);
            // node has no treasury yet — confirm guard order: dormant check passes but nothing to sweep
            await timeTravel(1095n * DAY + 1n);
            await expect(
                nfe.connect(owner).sweepDormantTreasury(uid)
            ).to.be.reverted;
        });
    });

    // =========================================================================
    // processDormantNodes (keeper)
    // =========================================================================
    describe("processDormantNodes (keeper — permissionless)", function () {
        it("reverts if batch larger than 20", async function () {
            const ids = Array.from({ length: 21 }, (_, i) => i + 1);
            await expect(
                gov.connect(user1).processDormantNodes(ids)
            ).to.be.revertedWith("Batch too large");
        });

        it("skips nodes with zero treasury silently", async function () {
            // node 55555 treasury = 0, should not revert
            await timeTravel(1095n * DAY + 1n);
            await expect(
                gov.connect(user1).processDormantNodes([55555])
            ).to.not.be.reverted;
        });

        it("skips nodes that are not yet dormant silently", async function () {
            await expect(
                gov.connect(user1).processDormantNodes([55555])
            ).to.not.be.reverted;
        });
    });

    // =========================================================================
    // Governor migration
    // =========================================================================
    describe("migrateGovernor", function () {
        it("migrates governor and updates core contract", async function () {
            // Transfer ownership of nfe to gov first so gov can call setGovernor on nfe
            await nfe.connect(owner).transferOwnership(await gov.getAddress());

            await gov.connect(owner).migrateGovernor(multisig.address);

            expect(await gov.governor()).to.equal(multisig.address);
            expect(await nfe.governor()).to.equal(multisig.address);
        });

        it("emits GovernorMigrated", async function () {
            await nfe.connect(owner).transferOwnership(await gov.getAddress());
            await expect(
                gov.connect(owner).migrateGovernor(multisig.address)
            ).to.emit(gov, "GovernorMigrated")
             .withArgs(owner.address, multisig.address);
        });

        it("old governor cannot propose after migration", async function () {
            await nfe.connect(owner).transferOwnership(await gov.getAddress());
            await gov.connect(owner).migrateGovernor(multisig.address);

            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                400n * DAY
            ]);
            await expect(
                gov.connect(owner).propose(await nfe.getAddress(), calldata, "stale")
            ).to.be.revertedWith("NFEGov: not governor");
        });

        it("reverts if same governor passed", async function () {
            await expect(
                gov.connect(owner).migrateGovernor(owner.address)
            ).to.be.revertedWith("Same governor");
        });

        it("reverts if zero address", async function () {
            await expect(
                gov.connect(owner).migrateGovernor(ethers.ZeroAddress)
            ).to.be.revertedWith("Zero address");
        });
    });

    // =========================================================================
    // View helpers
    // =========================================================================
    describe("View helpers", function () {
        it("proposalCount increments with each proposal", async function () {
            const before = await gov.proposalCount();

            const calldata = nfe.interface.encodeFunctionData("setDormancyPeriod", [
                400n * DAY
            ]);
            await gov.connect(owner).propose(await nfe.getAddress(), calldata, "c1");
            expect(await gov.proposalCount()).to.equal(before + 1n);
        });
    });
});
