// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./nfeglobal.sol";

contract nfeglobalMock is nfeglobal {
    constructor(
        address _firstUser,
        address _feeReceiver,
        address _rewardPool,
        address _owner,
        address _oracleAdmin,
        address _matrixAdmin
    ) nfeglobal(_firstUser, _feeReceiver, _rewardPool, _owner, _oracleAdmin, _matrixAdmin) {}

    function mockEnqueue(uint nodeId, uint tier) external {
        inTreasuryQueue[nodeId] = true;
        queuedTier[nodeId] = tier;
        queue[queueTail] = nodeId;
        queueTail++;
    }
}
