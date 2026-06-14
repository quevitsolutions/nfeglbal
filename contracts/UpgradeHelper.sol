// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface InfeglobalCore {
    function createNode(uint _sponsor) external payable;
    function unlockTier(uint _nodeId, uint _toTier) external payable;
    function nodeId(address user) external view returns (uint);
    function getTierCost(uint tier) external view returns (uint);
}

contract HelperNode {
    address public core;
    constructor(address _core) {
        core = _core;
    }
    
    function register(uint sponsor) external payable {
        InfeglobalCore(core).createNode{value: msg.value}(sponsor);
    }
    
    function upgrade(uint nodeId, uint toTier) external payable {
        InfeglobalCore(core).unlockTier{value: msg.value}(nodeId, toTier);
    }
    
    receive() external payable {}
}

contract MasterTest {
    function runTest(
        address h3,
        address h4,
        address x3,
        address x4,
        uint h3Id,
        uint h4Id,
        uint x3Id,
        uint x4Id,
        uint cost
    ) external payable {
        HelperNode(payable(h3)).upgrade{value: cost}(h3Id, 2);
        HelperNode(payable(h4)).upgrade{value: cost}(h4Id, 2);
        HelperNode(payable(x3)).upgrade{value: cost}(x3Id, 2);
        HelperNode(payable(x4)).upgrade{value: cost}(x4Id, 2);
    }
}
