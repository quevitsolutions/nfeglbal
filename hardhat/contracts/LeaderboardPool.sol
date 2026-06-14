// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IRewardPoolLeadership {
    function rank(uint256 nodeId) external view returns (uint8);
}

interface ICoreEngine {
    function getNodeWallet(uint256 nodeId) external view returns (address);
}

contract LeaderboardPool is ReentrancyGuard, Ownable {
    
    struct LeaderboardEntry {
        uint256 nodeId;
        uint256 score;
    }

    // Leaderboards (Top 10)
    LeaderboardEntry[10] public founderBoard;
    LeaderboardEntry[10] public seniorBoard;
    LeaderboardEntry[10] public ambassadorBoard;

    // Node scores per board (nodeId => boardId => score)
    // Board IDs: 1 = Founder, 2 = SeniorFounder, 3 = Ambassador
    mapping(uint256 => mapping(uint8 => uint256)) public scores;

    // Track claimable rewards per node (instant withdrawal)
    mapping(uint256 => uint256) public claimableRewards;
    mapping(uint256 => uint256) public claimedRewards;

    // Address configurations
    address public core;
    address public leadershipEngine;
    address public feeReceiverWallet;

    // Percentages for ranks 1 to 10 (basis points, sums to 10000 = 100%)
    uint16[10] public rankPercentages = [2000, 1500, 1000, 900, 800, 700, 600, 500, 400, 300];

    // Split for incoming BNB across boards (sums to 10000 = 100%)
    uint16 public founderBoardShareBP = 5000;    // 50%
    uint16 public seniorBoardShareBP = 3000;     // 30%
    uint16 public ambassadorBoardShareBP = 2000; // 20%

    // Transparency counters
    uint256 public totalReceived;
    uint256 public totalDistributed;

    event PointsRecorded(uint256 indexed nodeId, uint8 indexed boardId, uint256 score, uint256 pointsAdded);
    event BoardUpdated(uint256 indexed nodeId, uint8 indexed boardId, uint256 rankIndex, uint256 score);
    event DividendDistributed(uint8 indexed boardId, uint256 amount);
    event RewardClaimed(uint256 indexed nodeId, address indexed wallet, uint256 amount);

    constructor(
        address _core,
        address _leadershipEngine,
        address _feeReceiverWallet
    ) {
        require(_core != address(0), "Zero core address");
        require(_leadershipEngine != address(0), "Zero engine address");
        require(_feeReceiverWallet != address(0), "Zero fee receiver address");

        core = _core;
        leadershipEngine = _leadershipEngine;
        feeReceiverWallet = _feeReceiverWallet;
    }

    receive() external payable {
        if (msg.value == 0) return;
        totalReceived += msg.value;

        uint256 fShare = (msg.value * founderBoardShareBP) / 10000;
        uint256 sShare = (msg.value * seniorBoardShareBP) / 10000;
        uint256 aShare = msg.value - fShare - sShare; // avoid rounding loss

        if (fShare > 0) _distributeToBoard(1, fShare);
        if (sShare > 0) _distributeToBoard(2, sShare);
        if (aShare > 0) _distributeToBoard(3, aShare);
    }

    /**
     * @notice Record scoring points for a node. Called by core or reward pool.
     */
    function recordPoints(uint256 nodeId, uint256 actionType, uint256 amount) external {
        require(msg.sender == core || msg.sender == owner(), "Unauthorized caller");
        if (nodeId == 55555 || nodeId == 0) return; // Genesis exempt

        // Read dynamic rank of the node
        uint8 r = IRewardPoolLeadership(leadershipEngine).rank(nodeId);
        if (r == 0) return; // Only Rank 1 (Founder), 2 (Senior), 3 (Ambassador) participate

        uint256 points = 0;
        if (actionType == 1) { // Personal Upgrade
            points = 100 * amount;
        } else if (actionType == 2) { // Team Upgrade
            points = 10 * amount;
        } else if (actionType == 3) { // Volume
            points = amount / 10000000000000000; // 1 point per 0.01 BNB (1e16 wei)
        } else if (actionType == 4) { // Active Leaders
            points = 50 * amount;
        } else if (actionType == 5) { // Renewal
            points = 100 * amount;
        }

        if (points == 0) return;

        scores[nodeId][r] += points;
        emit PointsRecorded(nodeId, r, scores[nodeId][r], points);

        _updateLeaderboard(nodeId, scores[nodeId][r], r);
    }

    /**
     * @notice Claim leaderboard rewards for a node. Bypasses vesting vault.
     */
    function claim(uint256 nodeId) external nonReentrant {
        address wallet = ICoreEngine(core).getNodeWallet(nodeId);
        require(wallet != address(0), "Invalid node");
        require(msg.sender == wallet, "Not node wallet");

        uint256 reward = claimableRewards[nodeId];
        require(reward > 0, "No rewards to claim");

        claimableRewards[nodeId] = 0;
        claimedRewards[nodeId] += reward;
        totalDistributed += reward;

        (bool success, ) = payable(wallet).call{value: reward}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(nodeId, wallet, reward);
    }

    /**
     * @notice Read leaderboard contents for UI views.
     */
    function getBoard(uint8 boardId) external view returns (LeaderboardEntry[10] memory) {
        if (boardId == 1) return founderBoard;
        if (boardId == 2) return seniorBoard;
        return ambassadorBoard;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal functions
    // ─────────────────────────────────────────────────────────────────────────

    function _distributeToBoard(uint8 boardId, uint256 amount) internal {
        LeaderboardEntry[10] storage board = boardId == 1 ? founderBoard : boardId == 2 ? seniorBoard : ambassadorBoard;
        uint256 distributed = 0;

        for (uint256 i = 0; i < 10; i++) {
            uint256 nid = board[i].nodeId;
            if (nid > 0) {
                uint256 payout = (amount * rankPercentages[i]) / 10000;
                claimableRewards[nid] += payout;
                distributed += payout;
            }
        }

        // Refund any residual/unallocated leaderboard share back to the development wallet
        uint256 residual = amount - distributed;
        if (residual > 0) {
            (bool success, ) = payable(feeReceiverWallet).call{value: residual}("");
            require(success, "Residual transfer failed");
        }

        emit DividendDistributed(boardId, amount);
    }

    function _updateLeaderboard(uint256 nodeId, uint256 score, uint8 boardId) internal {
        LeaderboardEntry[10] storage board = boardId == 1 ? founderBoard : boardId == 2 ? seniorBoard : ambassadorBoard;
        
        // Check if node is already on the board
        int256 existingIdx = -1;
        for (uint256 i = 0; i < 10; i++) {
            if (board[i].nodeId == nodeId) {
                existingIdx = int256(i);
                break;
            }
        }

        if (existingIdx >= 0) {
            // Update score
            board[uint256(existingIdx)].score = score;
        } else {
            // Check if it qualifies to enter the board (better than the lowest/last score)
            if (score > board[9].score) {
                board[9] = LeaderboardEntry({ nodeId: nodeId, score: score });
            } else {
                return; // Does not qualify
            }
        }

        // Re-sort the board (insertion sort on size 10)
        for (uint256 i = 1; i < 10; i++) {
            LeaderboardEntry memory key = board[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && board[uint256(j)].score < key.score) {
                board[uint256(j + 1)] = board[uint256(j)];
                j--;
            }
            board[uint256(j + 1)] = key;
        }

        // Emit update events for positions
        for (uint256 i = 0; i < 10; i++) {
            if (board[i].nodeId == nodeId) {
                emit BoardUpdated(nodeId, boardId, i, score);
            }
        }
    }

    // Owner administration
    function setBoardShares(uint16 _founder, uint16 _senior, uint16 _ambassador) external onlyOwner {
        require(_founder + _senior + _ambassador == 10000, "Must sum to 10000");
        founderBoardShareBP = _founder;
        seniorBoardShareBP = _senior;
        ambassadorBoardShareBP = _ambassador;
    }

    function setRankPercentages(uint16[10] calldata _pcts) external onlyOwner {
        uint16 sum = 0;
        for (uint256 i = 0; i < 10; i++) {
            sum += _pcts[i];
        }
        require(sum <= 10000, "Exceeds 100%");
        rankPercentages = _pcts;
    }
}
