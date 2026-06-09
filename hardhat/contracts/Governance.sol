// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INodeFlowEngineGov {
    function nodeId(address user) external view returns (uint256);
    function getUserLevel(uint256 _userId) external view returns (uint256);
}

contract Governance {
    INodeFlowEngineGov public immutable engine;
    
    enum ProposalStatus { Created, Succeeded, Queued, Executed, Defeated }
    
    struct Proposal {
        uint256 id;
        uint256 proposerNodeId;
        address payable target;
        uint256 amount;
        string purpose;
        uint256 createdAt;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 timelockStartsAt;
        bool executed;
        uint256 coreProposalId; // legacy unused field
    }
    
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    // proposalId => nodeId => bool
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;
    
    event ProposalCreated(
        uint256 indexed id,
        uint256 indexed proposerNodeId,
        address target,
        uint256 amount,
        string purpose,
        uint256 votingEndsAt
    );
    event VoteCast(uint256 indexed proposalId, uint256 indexed nodeId, bool support, uint256 weight);
    event ProposalQueued(uint256 indexed id, uint256 timelockEndsAt);
    event ProposalExecuted(uint256 indexed id);
    
    constructor(address _engine) {
        require(_engine != address(0), "Zero engine address");
        engine = INodeFlowEngineGov(_engine);
    }
    
    receive() external payable {}

    function daoTreasury() external view returns (uint256) {
        return address(this).balance;
    }

    function propose(address payable _target, uint256 _amount, string calldata _purpose) external returns (uint256) {
        uint256 proposerId = engine.nodeId(msg.sender);
        require(proposerId > 0, "Only active nodes can propose");
        require(_target != address(0), "Zero target address");
        require(_amount > 0, "Amount must be greater than zero");
        require(_amount <= address(this).balance, "Amount exceeds DAO Treasury");
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposerNodeId: proposerId,
            target: _target,
            amount: _amount,
            purpose: _purpose,
            createdAt: block.timestamp,
            votesFor: 0,
            votesAgainst: 0,
            timelockStartsAt: 0,
            executed: false,
            coreProposalId: 0
        });
        
        emit ProposalCreated(proposalId, proposerId, _target, _amount, _purpose, block.timestamp + 7 days);
        return proposalId;
    }
    
    function vote(uint256 _proposalId, bool _support) external {
        uint256 voterNodeId = engine.nodeId(msg.sender);
        require(voterNodeId > 0, "Only active nodes can vote");
        
        Proposal storage prop = proposals[_proposalId];
        require(prop.createdAt > 0, "Proposal does not exist");
        require(block.timestamp <= prop.createdAt + 7 days, "Voting period ended");
        require(!hasVoted[_proposalId][voterNodeId], "Already voted");
        
        uint256 weight = engine.getUserLevel(voterNodeId);
        require(weight > 0, "Zero voting weight");
        
        hasVoted[_proposalId][voterNodeId] = true;
        
        if (_support) {
            prop.votesFor += weight;
        } else {
            prop.votesAgainst += weight;
        }
        
        emit VoteCast(_proposalId, voterNodeId, _support, weight);
    }
    
    function queue(uint256 _proposalId) external {
        Proposal storage prop = proposals[_proposalId];
        require(prop.createdAt > 0, "Proposal does not exist");
        require(block.timestamp > prop.createdAt + 7 days, "Voting period active");
        require(prop.timelockStartsAt == 0, "Already queued");
        require(prop.votesFor > prop.votesAgainst, "Proposal defeated");
        
        prop.timelockStartsAt = block.timestamp;
        
        emit ProposalQueued(_proposalId, block.timestamp + 2 days);
    }
    
    function execute(uint256 _proposalId) external {
        Proposal storage prop = proposals[_proposalId];
        require(prop.timelockStartsAt > 0, "Proposal not queued");
        require(block.timestamp > prop.timelockStartsAt + 2 days, "Timelock period active");
        require(!prop.executed, "Already executed");
        require(prop.amount <= address(this).balance, "Amount exceeds DAO Treasury");
        
        prop.executed = true;
        
        (bool ok, ) = prop.target.call{value: prop.amount}("");
        require(ok, "Transfer failed");
        
        emit ProposalExecuted(_proposalId);
    }
    
    function getProposalStatus(uint256 _proposalId) external view returns (ProposalStatus) {
        Proposal memory prop = proposals[_proposalId];
        if (prop.createdAt == 0) revert("Proposal does not exist");
        if (prop.executed) return ProposalStatus.Executed;
        
        if (block.timestamp <= prop.createdAt + 7 days) {
            return ProposalStatus.Created;
        }
        
        if (prop.votesFor <= prop.votesAgainst) {
            return ProposalStatus.Defeated;
        }
        
        if (prop.timelockStartsAt == 0) {
            return ProposalStatus.Succeeded;
        }
        
        return ProposalStatus.Queued;
    }
}
