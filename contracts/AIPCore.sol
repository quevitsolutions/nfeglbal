// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./IAIPCore.sol";
import "./AIPViews.sol";

interface AggregatorV3Interface {
  function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @dev Minimal interface for calling RewardPool.registerNode() from AIPCore.
 *      This allows AIPCore to auto-register newly eligible nodes without
 *      the user having to call registerNode() manually.
 */
interface IRewardPool {
    function registerNode(uint nodeId) external;
}

contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

/**
 * @title  NodeFlow Engine
 * @author NodeFlow Protocol
 * @notice A decentralized, on-chain community coordination protocol that distributes
 *         rewards algorithmically based on network expansion and participation.
 *
 *         ┌──────────────────────────────────────────────────────────────┐
 *         │  Every participant  =  a Node                                │
 *         │  Nodes connect via referrals                                 │
 *         │  Smart contract calculates reward flows automatically        │
 *         │  Everything is transparent on-chain                          │
 *         │  No manual payout. No admin interference in reward logic.    │
 *         └──────────────────────────────────────────────────────────────┘
 *
 * ── ARCHITECTURE ────────────────────────────────────────────────────────
 *
 *   1️⃣  NODES
 *       Each registered node becomes a Node, identified by a unique Node ID.
 *       Nodes form the network — the more Nodes, the deeper the reward flow.
 *
 *   2️⃣  LAYERS
 *       Each unlockTier (L0–L17) unlocks deeper reward layers.
 *       Higher layers = broader reach across the referral tree and matrix.
 *
 *   3️⃣  FLOW LOGIC
 *       The smart contract distributes three reward streams automatically:
 *         • Direct Reward  — paid to the immediate sponsor on createNode/unlockTier
 *         • Layer Reward   — distributed across 18 parentId referral layers
 *         • Matrix Reward  — distributed through the binary matrix tree
 *
 * ── HOW NODEFLOW WORKS ───────────────────────────────────────────────────
 *
 *   Step 1: Create Node     → call createNode() and get a unique Node ID
 *   Step 2: Connect         → link to a sponsor Node via referral ID
 *   Step 3: Unlock Layers   → call unlockTier() to progress through L1–L17
 *   Step 4: Earn Rewards    → algorithmic distributions flow automatically
 *
 * ── TECHNICAL OVERVIEW ───────────────────────────────────────────────────
 *
 * @dev    - Referral tree:  18-layer parentId chain  → Layer (level) income
 *         - Binary matrix:  BFS-placed binary tree → Matrix (cyclic) income
 *         - 18 unlockTier tiers (L0–L17), each doubling in USD cost
 *         - BNB price fetched from a Chainlink AggregatorV3Interface feed
 *         - Failed push-transfers credited to pendingReward (Pull Payment)
 *         - 5% platform fee deducted from every individual distribution
 *         - Genesis Node ID: 36999 (root of referral and matrix tree)
 */
contract AIPCore is ReentrancyGuard, IAIPCore {
    AggregatorV3Interface internal priceFeed;

    uint private constant baseDivider = 10000;
    uint private constant TRANSFER_GAS_LIMIT = 100000; // Gas limit for safe transfers    
    uint public immutable defaultRefer;
    address private feeReceiver;
    address private rewardPool;
    address public oracleAdmin;
    address public matrixAdmin;

    uint public bnbPrice;
    uint public lastPriceUpdate;
    
    // Price safety bounds (future-proofed for bull market)
    uint public maxAllowedPrice = 5000e8;  // $5000 max BNB price (8 decimals)
    uint public minAllowedPrice = 100e8;   // $100 min BNB price (8 decimals)
    uint private constant MAX_PRICE_DEVIATION = 2000; // 20% max price change (oracle)
    uint private constant MAX_MANUAL_PRICE_DEVIATION = 5000; // 50% max change (emergency manual)
    uint private constant PRICE_STALENESS_THRESHOLD = 24 hours;
    uint private rescueTimeLock;
    uint private constant RESCUE_DELAY = 48 hours;
    
    uint public maxMatrixDepth = 25;
    uint private constant directPercent = 1000;
    uint private constant layerDepth = 17;
    uint private constant minDirectNodes = 2;
    uint private constant minDirectNodesHigh = 5;


    uint private constant cyclicPercent = 7000;
    // 5% Global Reward Pool allocation
    uint private constant rewardPoolPercent = 500;

    // Levels in USD (18 decimals).
    // L0:$5, L1:$5, L2:$10, then doubling every level up to L17
    uint[18] private tierPriceUSD = [
        5e18,       // L0  - $5         (Register)
        5e18,       // L1  - $5
        10e18,      // L2  - $10
        20e18,      // L3  - $20
        40e18,      // L4  - $40
        80e18,      // L5  - $80
        160e18,     // L6  - $160
        320e18,     // L7  - $320
        640e18,     // L8  - $640
        1280e18,    // L9  - $1,280
        2560e18,    // L10 - $2,560
        5120e18,    // L11 - $5,120
        10240e18,   // L12 - $10,240
        20480e18,   // L13 - $20,480
        40960e18,   // L14 - $40,960
        81920e18,   // L15 - $81,920
        163840e18,  // L16 - $163,840
        327680e18   // L17 - $327,680
    ];


    // Node, RewardInfo, RewardEvent structs are defined in INodeFlowEngine


    uint public totalNodes;
    uint public totalBNBDistributed;   // cumulative BNB ever distributed to nodes (wei)
    uint private _nextId; // deterministic incrementing ID counter
    uint[] public globalNodes;
    mapping (uint => Node) public nodes;
    mapping (uint => RewardInfo) public rewardInfo;
    mapping (uint => RewardEvent[]) public rewardHistory;
    mapping (uint => mapping (uint => uint[])) public teams;
    mapping (uint => mapping (uint => uint[])) public networkTree;
    mapping (uint => uint) public matrixChildCount;
    mapping(address => uint) public nodeId;
    mapping(uint => mapping (uint => uint)) public nodeDayReward;
    // Pull-payment: failed transfers are credited here for the recipient to withdraw
    mapping(address => uint) public pendingReward;
    mapping(uint => mapping(uint => uint)) public missedRewardsByTier; // nodeId -> tier -> amount
    uint public totalMissedRewards;
    uint public totalPendingRewards;
    address public owner;

    // All events are declared in INodeFlowEngine.sol and inherited via `is INodeFlowEngine`.

    /**
     * @param _firstUser     Genesis wallet address (root of referral tree)
     * @param _feeReceiver   Address for platform fees
     * @param _rewardPool    RewardPool address (address(0) OK — set later via setAddr(1,...))
     * @param _owner         Contract owner
     * @param _oracleAdmin   Address that can update the BNB price oracle
     * @param _matrixAdmin   Address that can adjust matrix parameters
     * Note: Oracle price feed is set post-deploy via setAddr(11, priceFeedAddr, 0)
     */
    constructor(
        address _firstUser,
        address _feeReceiver,
        address _rewardPool,
        address _owner,
        address _oracleAdmin,
        address _matrixAdmin
    ) {
        require(_firstUser   != address(0), "Invalid genesis addr");
        require(_feeReceiver != address(0), "Invalid fee addr");
        require(_owner       != address(0), "Invalid owner addr");
        require(_oracleAdmin != address(0), "Invalid oracle addr");
        require(_matrixAdmin != address(0), "Invalid matrix addr");

        owner       = _owner;
        oracleAdmin = _oracleAdmin;
        matrixAdmin = _matrixAdmin;

        bnbPrice        = 60000000000; // Default $600 (8 decimals)
        lastPriceUpdate = block.timestamp;

        feeReceiver = _feeReceiver;
        if (_rewardPool != address(0)) {
            rewardPool = _rewardPool;
        }

        defaultRefer = 36999;
        _nextId      = defaultRefer + 1;

        uint newId = defaultRefer;
        nodeId[_firstUser] = newId;
        Node storage node  = nodes[newId];
        node.nodeId        = uint64(newId);
        node.sponsor       = 0;
        node.matrixParent  = 0;
        node.wallet        = _firstUser;
        globalNodes.push(node.nodeId);
        totalNodes += 1;
        node.tier     = 1;
        node.joinedAt = uint40(block.timestamp);
        node.totalContribution += getTierCost(0);
    }
    receive() external payable {}

    function getTierCost(uint _index) public view returns (uint) {
        if(bnbPrice == 0) return 1e15; // Fallback safe
        
        // Graceful Fallback: if price is stale, do not revert. 
        // Just use the last known good price to keep the protocol operational.
        if (block.timestamp > lastPriceUpdate + PRICE_STALENESS_THRESHOLD) {
            return tierPriceUSD[_index] * 1e8 / bnbPrice; // use last price
        }
        
        // tierPriceUSD: 18-decimal USD  (e.g. 5e18 = $5)
        // bnbPrice:       8-decimal USD  (e.g. 60000000000 = $600)
        // BNB wei = (usdAmount / 1e18) / (bnbPrice / 1e8) * 1e18
        //         = usdAmount * 1e8 / bnbPrice
        return tierPriceUSD[_index] * 1e8 / bnbPrice;
    }

    function _syncOraclePrice() private {
        if(address(priceFeed) != address(0)) {
             try priceFeed.latestRoundData() returns (
                 uint80 /* roundId */,
                 int256 price,
                 uint256 /* startedAt */,
                 uint256 updatedAt,
                 uint80 /* answeredInRound */
             ) {
                 // Validate price is recent (within 1 hour)
                 if (block.timestamp - updatedAt > 1 hours) return;
                 // Ensure this is newer than our last update
                 if (updatedAt <= lastPriceUpdate) return;
                 if (price <= 0) return;
                 
                 uint newPrice = uint(price);
                 
                 // Validate price bounds
                 if (newPrice < minAllowedPrice || newPrice > maxAllowedPrice) return;
                 
                 // Validate deviation (max 20% change)
                 uint deviation = newPrice > bnbPrice ? 
                     ((newPrice - bnbPrice) * 10000) / bnbPrice :
                     ((bnbPrice - newPrice) * 10000) / bnbPrice;
                     
                 if (deviation > MAX_PRICE_DEVIATION) return;
                 
                 bnbPrice = newPrice;
                 lastPriceUpdate = block.timestamp;
                 emit OraclePriceUpdated(bnbPrice, block.timestamp);
             } catch {
                 emit OracleError(address(priceFeed), block.timestamp);
             }
        }
    }

    function _pushReward(address _to, uint _amt) private {
        if(_amt > 0) {
            require(_to != address(0), "Invalid address");
            (bool success, ) = payable(_to).call{value: _amt, gas: TRANSFER_GAS_LIMIT}("");
            if(!success) {
                // Pull-payment fallback: credit recipient — no centralisation to feeReceiver
                pendingReward[_to] += _amt;
                totalPendingRewards += _amt;
                emit RewardPending(_to, _amt);
            } else {
                totalBNBDistributed += _amt; // track cumulative BNB flow for transparency
            }
        }
    }

    /// @notice Claim any BNB that failed to push to your address
    function withdraw() external nonReentrant {
        uint amount = pendingReward[msg.sender];
        require(amount > 0, "Nothing");
        pendingReward[msg.sender] = 0; // zero before transfer (re-entrancy safe)
        totalPendingRewards -= amount;
        totalBNBDistributed += amount; // A4 Fix: count pulled rewards in transparency tracker
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    /// @notice Returns total BNB locked in treasury as missed rewards for a node across all tiers
    function getPendingUpgradeRewards(uint _nodeId) external view returns (uint total) {
        for (uint i = 0; i < 18; i++) {
            total += missedRewardsByTier[_nodeId][i];
        }
    }

    function _routeToPool(address _pool, uint _amt) private {
        if(_amt > 0) {
            // If pool address is unset (zero), send to feeReceiver instead
            if(_pool == address(0)) {
                _pushReward(feeReceiver, _amt);
            } else {
                _pushReward(_pool, _amt);
            }
        }
    }

    function _recordReward(uint _fromNode, uint _toNode, uint _tier, uint _amount, uint _type, bool _isMissed, uint _layerIndex) private {
        if (_isMissed) {
            rewardInfo[_toNode].missedReward += _amount;
        } else {
            rewardInfo[_toNode].totalRewards += _amount;
            if (_type == 1) rewardInfo[_toNode].sponsorReward += _amount;
            else if (_type == 2) rewardInfo[_toNode].layerReward += _amount;
            else if (_type == 3) rewardInfo[_toNode].matrixReward += _amount;
            
            rewardInfo[_toNode].tierRewards[_tier] += _amount;
            nodeDayReward[_toNode][getNodeCurDay(_toNode)] += _amount;
        }

        rewardHistory[_toNode].push(RewardEvent(_fromNode, _layerIndex, _amount, block.timestamp, _isMissed, _type, _tier));
        emit RewardDistributed(nodes[_fromNode].wallet, _toNode, _fromNode, _layerIndex, _amount, block.timestamp, _isMissed, _type, _tier);
    }

    /// @notice Step 1: Owner or Oracle Admin schedules a rescue — must wait 48h before executing
    function scheduleRescueBNB() external {
        require(msg.sender == owner || msg.sender == oracleAdmin, "unauth");
        rescueTimeLock = block.timestamp + RESCUE_DELAY;
        emit RescueScheduled(rescueTimeLock);
    }

    /// @notice Step 2: Execute rescue after 48h time-lock has passed. 
    /// Sends funds to msg.sender (must be owner or oracleAdmin).
    function rescueBNB(uint _amount) external {
        require(msg.sender == owner || msg.sender == oracleAdmin, "unauth");
        require(rescueTimeLock != 0, "Not scheduled");
        require(block.timestamp >= rescueTimeLock, "Timelocked");
        rescueTimeLock = 0; // reset after use — must reschedule for next rescue
        (bool ok,) = payable(msg.sender).call{value: _amount}("");
        require(ok, "Rescue failed");
    }

    function createNode(uint _sponsor) external payable nonReentrant {
        if(block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }

        require(nodeId[msg.sender] == 0, "User exists");
        require(nodes[_sponsor].joinedAt > 0 || _sponsor == defaultRefer, "Sponsor not found");
   
        // Deterministic incrementing ID — auditor-safe, O(1), no manipulation risk
        uint newId = _nextId;
        _nextId += 1;
        nodeId[msg.sender] = newId;
        Node storage node = nodes[newId];
        node.nodeId = uint64(newId);

        uint calcAmt = getTierCost(0);
        require(msg.value >= calcAmt, "Insufficient BNB"); 
        if(msg.value > calcAmt) {
            // M1: use .call instead of .transfer to support contract wallets
            (bool ok,) = payable(msg.sender).call{value: msg.value - calcAmt}("");
            require(ok, "Refund failed");
        }

        node.sponsor = uint64(_sponsor);
        node.wallet = msg.sender;
       
        nodes[node.sponsor].directNodes += 1;
        uint parentId = node.sponsor;
        for(uint i=0; i<layerDepth; i++) {
            if(parentId == 0) break;
            networkTree[parentId][i].push(node.nodeId);
            parentId = nodes[parentId].sponsor;
        }

        // Platform fee removal: no upfront fee transfer to reward wallet
        
        // Platform fee removal: toDist is the full direct reward
        uint toDist = calcAmt * directPercent / baseDivider;
        
        _pushReward(nodes[node.sponsor].wallet, toDist);

        uint rewardPoolAmount = calcAmt * rewardPoolPercent / baseDivider;
        _routeToPool(rewardPool, rewardPoolAmount);

        _recordReward(node.nodeId, node.sponsor, 0, toDist, 1, false, 1);

        globalNodes.push(node.nodeId);
        if(totalNodes > 0){ _assignMatrixPosition(node.nodeId, node.sponsor);}

        _distributeMatrixRewards(node.nodeId, 0);
        _distributeLayerRewards(node.nodeId, 0);

        // ── TREASURY RELEASE on node creation (tier 0) ──
        if(missedRewardsByTier[node.nodeId][0] > 0) {
            uint release = missedRewardsByTier[node.nodeId][0];
            missedRewardsByTier[node.nodeId][0] = 0;
            totalMissedRewards -= release;
            _pushReward(node.wallet, release);
        }

        // Dust Sweep: only sweep transaction dust, preserve treasury + pull-payment reserves.
        uint reservedBalance = totalMissedRewards + totalPendingRewards;
        uint sweepable = address(this).balance > reservedBalance
            ? address(this).balance - reservedBalance
            : 0;
        if (sweepable > 1e12) {
            _pushReward(feeReceiver, sweepable);
        }

        node.joinedAt = uint40(block.timestamp);
        totalNodes += 1;
        node.tier += 1;
        node.totalContribution += calcAmt;
        nodes[_sponsor].sponsorTierRanks[0] += 1;
        emit NodeCreated(node.wallet, node.nodeId, node.sponsor, node.matrixParent);

        // Signal keeper bot to handle pool registration off-chain (zero gas for user)
        emit PoolCheckRequired(newId, block.timestamp);
    }


    function unlockTier(uint _nodeId, uint _toTier) external payable nonReentrant {
        if(block.timestamp > lastPriceUpdate + 24 hours) {
            _syncOraclePrice();
        }

        bool isSuper = (_nodeId == defaultRefer); // Genesis upgrades free
        Node storage node = nodes[_nodeId];
        require(node.nodeId != 0, "Node not found");
        // M2 Fix: only the node owner (or contract owner) can upgrade a tier
        require(msg.sender == node.wallet || msg.sender == owner, "Not owner");
        require(_toTier > node.tier, "Tier lowered");
        require(_toTier <= 18, "Max tier");

        uint initialLvl = node.tier;

        // ── DYNAMIC TIER CALCULATION ──────────────────────────────────────────
        // Start from the user's first target tier. If they have enough BNB to
        // unlock at least 1 tier, proceed. Unlock as many tiers as msg.value
        // covers (up to _toTier), then refund the remainder.
        uint firstTierCost = getTierCost(initialLvl);
        if(!isSuper) {
            require(msg.value >= firstTierCost, "Insufficient BNB for 1 tier");
        }

        // Calculate how many tiers can be unlocked with the sent value
        uint totalAmount = 0;
        uint lvlsAffordable = 0;
        uint maxLvls = _toTier - initialLvl;
        for(uint i = initialLvl; i < initialLvl + maxLvls; i++) {
            uint c = getTierCost(i);
            if(!isSuper && totalAmount + c > msg.value) break;
            totalAmount += c;
            lvlsAffordable++;
        }

        // Refund any excess BNB sent beyond what's needed
        if(!isSuper && msg.value > totalAmount) {
            (bool ok,) = payable(msg.sender).call{value: msg.value - totalAmount}("");
            require(ok, "Refund fail");
        }

        // ── TIER UNLOCK LOOP ──────────────────────────────────────────────────
        for(uint i = initialLvl; i < initialLvl + lvlsAffordable; i++)
        {
            uint costI = getTierCost(i);

            if(!isSuper)
            {
                // Direct sponsor reward
                uint toDist = costI * directPercent / baseDivider;
                _pushReward(nodes[node.sponsor].wallet, toDist);
                _recordReward(_nodeId, node.sponsor, i, toDist, 1, false, i+1);

                uint rewardPoolAmount = costI * rewardPoolPercent / baseDivider;
                _routeToPool(rewardPool, rewardPoolAmount);

                _distributeLayerRewards(_nodeId, i);
                _distributeMatrixRewards(_nodeId, i);
            }

            // ── TREASURY RELEASE: Pay out any missed rewards stored for this tier ──
            // These were locked when the user's uplines were not yet at this tier.
            // Now that the node itself is upgrading to i+1, release its own locked funds.
            if(missedRewardsByTier[_nodeId][i] > 0) {
                uint release = missedRewardsByTier[_nodeId][i];
                missedRewardsByTier[_nodeId][i] = 0;
                totalMissedRewards -= release;
                _pushReward(node.wallet, release);
            }

            node.tier += 1;
            uint rankIdx = i < 18 ? i : 17;
            nodes[node.sponsor].sponsorTierRanks[rankIdx] += 1;
            emit TierUnlocked(node.wallet, node.nodeId, i+1);
        }

        node.totalContribution += totalAmount;

        // ── DUST SWEEP ────────────────────────────────────────────────────────
        // Only sweep true transaction dust — never touch treasury (missedRewards)
        // or pull-payment reserves (totalPendingRewards).
        uint reservedBalance = totalMissedRewards + totalPendingRewards;
        uint sweepable = address(this).balance > reservedBalance
            ? address(this).balance - reservedBalance
            : 0;
        if (sweepable > 1e12) {
            _pushReward(feeReceiver, sweepable);
        }

        // Signal keeper bot to handle pool registration off-chain (zero gas for user)
        emit PoolCheckRequired(_nodeId, block.timestamp);
    }


    function _distributeLayerRewards(uint _nodeId, uint _tier) private {
        // BUG FIX: Start from the DIRECT SPONSOR (Layer 1). Previous code started
        // from grandparent's sponsor, skipping Layer 1 and Layer 2 entirely.
        uint parentId = nodes[_nodeId].sponsor;
        uint cost = getTierCost(_tier);

        for(uint i=0; i<layerDepth; i++)
        {
            if(parentId == 0) break;

            uint _percent = 0;
            if (i <= 4) {
                _percent = 150;
            } else if (i <= 9) {
                _percent = 100;
            } else {
                _percent = 35;
            }

            uint toDist = cost * _percent / baseDivider;
            
            // Qualification: L1-L5 (i=0..4): no direct requirement.
            // L6-L18 (i=5..16): must have 2 direct referrals.
            uint reqDirects = (i >= 5) ? minDirectNodes : 0;
            
            bool isQualified = (nodes[parentId].directNodes >= reqDirects);

            if(nodes[parentId].tier > _tier && isQualified)
            {
                _pushReward(nodes[parentId].wallet, toDist);
                _recordReward(_nodeId, parentId, _tier, toDist, 2, false, i+1);
            } else {
                // TREASURY: Lock missed reward in contract — released when upline upgrades
                missedRewardsByTier[parentId][_tier] += toDist;
                totalMissedRewards += toDist;
                _recordReward(_nodeId, parentId, _tier, toDist, 2, true, i+1);
            }

            parentId = nodes[parentId].sponsor;
        }
    }
 
    function _distributeMatrixRewards(uint _nodeId, uint _tier) private {
        uint cost = getTierCost(_tier);

        // 🔥 70% MATRIX PORTION
        uint totalMatrix = cost * 7000 / 10000;

        // 🔥 PRIMARY (tier-based receiver)
        uint primary = nodes[_nodeId].matrixRewardReceiver[_tier];

        // ✅ STEP 1: PRIMARY QUALIFIED
        if (primary != 0 && nodes[primary].tier > _tier) {
            _pushReward(nodes[primary].wallet, totalMatrix);
            _recordReward(_nodeId, primary, _tier, totalMatrix, 3, false, _tier + 1);
            return;
        }

        // 🔁 STEP 2: FALLBACK SPLIT (10 LEVELS)
        uint[10] memory percents = [
            uint(550), 650, 700, 750, 800, 
            850, 800, 750, 700, 450
        ];

        uint current = nodes[_nodeId].matrixParent;
        uint distributed = 0;

        for (uint i = 0; i < 10; i++) {
            if (current == 0) {
                current = defaultRefer;
            }

            uint reward = totalMatrix * percents[i] / 7000;

            // ✅ QUALIFICATION
            bool qualified = nodes[current].tier > _tier;

            if (qualified) {
                _pushReward(nodes[current].wallet, reward);
                _recordReward(_nodeId, current, _tier, reward, 3, false, i + 1);
            } else {
                // TREASURY: Lock missed matrix reward — released when upline upgrades
                missedRewardsByTier[current][_tier] += reward;
                totalMissedRewards += reward;
                _recordReward(_nodeId, current, _tier, reward, 3, true, i + 1);
            }

            distributed += reward;
            current = nodes[current].matrixParent;
        }

        // 🔧 DUST HANDLING — route tiny remainder to pool
        uint dust = totalMatrix - distributed;
        if (dust > 0) {
            _routeToPool(rewardPool, dust);
        }
    }
 
    /**
     * @dev A2 Fix: Robust BFS to find the EARLIEST empty spot in the sponsor's tree.
     * Guarantees a perfect binary structure (max 2 children per node).
     */
    function _assignMatrixPosition(uint _nodeId, uint _sponsor) private {
        uint parentId = 0;
        
        // BFS Queue - size 512 is plenty for reasonable tree search
        uint[] memory queue = new uint[](512);
        uint head = 0;
        uint tail = 0;
        
        queue[tail++] = _sponsor;
        
        while (head < tail) {
            uint current = queue[head++];
            
            // Check current node's vacancy
            if (teams[current][0].length < 2) {
                parentId = current;
                break;
            }
            
            // Push children to queue for breadth-first search
            for (uint i = 0; i < teams[current][0].length; i++) {
                if (tail < 512) {
                    queue[tail++] = teams[current][0][i];
                }
            }
        }
        
        // Fallback to genesis just in case (should not happen in normal tree)
        if (parentId == 0) parentId = defaultRefer;

        nodes[_nodeId].matrixParent = uint64(parentId);
        teams[parentId][0].push(_nodeId);
        matrixChildCount[parentId] = uint(teams[parentId][0].length);

        // PRE-COMPUTE O(1) MATRIX REWARD TARGETS (up to 18 levels)
        uint currentTarget = parentId;
        for(uint t=0; t<18; t++) {
            if(currentTarget == 0) {
                nodes[_nodeId].matrixRewardReceiver[t] = uint64(defaultRefer);
            } else {
                nodes[_nodeId].matrixRewardReceiver[t] = uint64(currentTarget);
                currentTarget = nodes[currentTarget].matrixParent;
            }
        }

        // Upward update: update descendant counts and local team views for all ancestors
        uint currentId = parentId;
        for(uint i=0; i<maxMatrixDepth; i++) {
            if(currentId == 0) break;
            nodes[currentId].totalMatrixNodes += 1;
            if (i > 0) {
                teams[currentId][i].push(_nodeId); // i=1 means Layer 2 in UI
            }
            currentId = nodes[currentId].matrixParent;
        }
    }

    function isNodeActive(uint userId) public view returns (bool) {
        return (nodes[userId].nodeId != 0);
    }

    function isNodeRegistered(address node) public view returns (bool) {
            return (nodeId[node] != 0);
    }

    function getMatrixUsers(uint _nodeId, uint _layer, uint _startIndex, uint _num) external view returns(Node[] memory) {
        return AIPViews.getMatrixUsers(nodes, teams, _nodeId, _layer, _startIndex, _num);
    }

    function getIncome(uint _nodeId, uint _length) external view returns(RewardEvent[] memory) {
        return AIPViews.getIncome(rewardHistory, _nodeId, _length);
    }

    function getMissedIncome(uint _nodeId, uint _length) external view returns(RewardEvent[] memory) {
        return AIPViews.getMissedIncome(rewardHistory, _nodeId, _length);
    }

    function getIncomeByType(uint _nodeId, uint _type, uint _length) external view returns(RewardEvent[] memory) {
        return AIPViews.getIncomeByType(rewardHistory, _nodeId, _type, _length);
    }

    function getMatrixDirect(uint _nodeId) external view returns(uint[2] memory _directs) {
        for(uint i=0; i<teams[_nodeId][0].length && i<2; i++) {
            _directs[i] = teams[_nodeId][0][i];
        }
    }

    function getNetworkNodes(uint _nodeId, uint _layer, uint _num) external view returns(Node[] memory) {
        return AIPViews.getNetworkNodes(nodes, networkTree, _nodeId, _layer, _num);
    } 

    function getNetworkNodesWithStats(uint _nodeId, uint _layer, uint _num) external view returns(NodeWithStats[] memory) {
        return AIPViews.getNetworkNodesWithStats(nodes, rewardInfo, networkTree, _nodeId, _layer, _num);
    } 



    function getNodeCurDay(uint _nodeId) public view returns(uint) {
        return (block.timestamp - nodes[_nodeId].joinedAt) / 24 hours;
    }


    function getTierRewards(uint _nodeId) external view returns(uint[18] memory) {
        return rewardInfo[_nodeId].tierRewards;
    }   

    function setAddr(uint _type, address _new, uint _num) external {
        if(_type == 0) {
            require(msg.sender == owner, "unauth");
            require(_new != address(0), "Zero address");
            address oldAddr = feeReceiver;
            feeReceiver = _new;
            emit AddressUpdated(0, _new, oldAddr);                  
        } 
        else if(_type == 1) {
            require(msg.sender == owner, "unauth");
            require(_new != address(0), "Zero address");
            address oldAddr = rewardPool;
            rewardPool = _new;
            emit AddressUpdated(1, _new, oldAddr);                  
        } 
        else if(_type == 12) { // Update Genesis Wallet
            require(msg.sender == owner, "unauth");
            require(_new != address(0), "Zero address");
            require(nodeId[_new] == 0, "Address already registered"); 
            address oldWallet = nodes[defaultRefer].wallet;
            nodeId[oldWallet] = 0;
            nodes[defaultRefer].wallet = _new;
            nodeId[_new] = defaultRefer;
            emit AddressUpdated(12, _new, oldWallet);
        }

        else if(_type == 6) {
            require(msg.sender == matrixAdmin || msg.sender == owner, "unauth");
            require(_num >= 1, "maxMatrixDepth must be >= 1"); // L1: prevent zero breaking BFS
            uint oldValue = maxMatrixDepth;
            maxMatrixDepth = _num;
            emit LayersUpdated(0, oldValue, _num);
        }
        else if(_type == 7) {
            require(msg.sender == matrixAdmin || msg.sender == owner, "unauth");
            require(_new != address(0), "Cannot set to zero address");
            matrixAdmin = _new;
            emit MatrixAdminUpdated(_new);
        }
        // Price Admin Functions
        else if(_type == 10) {
            require(msg.sender == oracleAdmin || msg.sender == owner, "unauth");
            require(_new != address(0), "Cannot set to zero address");
            oracleAdmin = _new;
            emit OracleAdminUpdated(_new);
        }
        else if(_type == 11) {
            require(msg.sender == oracleAdmin || msg.sender == owner, "unauth");
            require(_new != address(0), "Zero feed address"); // A14 Fix
            priceFeed = AggregatorV3Interface(_new);
            _syncOraclePrice();
        }
        else {
            revert("Unknown setAddr type"); // A6 Fix: reject unknown type codes
        }
    }

    function manualUpdatePrice(uint _newPrice) external {
        require(msg.sender == oracleAdmin, "unauth");
        require(_newPrice >= minAllowedPrice && _newPrice <= maxAllowedPrice, "Price OOB");
        
        // Limit manual updates to 50% max deviation for safety
        uint deviation = _newPrice > bnbPrice ? 
            ((_newPrice - bnbPrice) * 10000) / bnbPrice :
            ((bnbPrice - _newPrice) * 10000) / bnbPrice;
            
        require(deviation <= MAX_MANUAL_PRICE_DEVIATION, "Max deviation exceeded");
        
        bnbPrice = _newPrice;
        lastPriceUpdate = block.timestamp;
        emit OraclePriceUpdated(_newPrice, block.timestamp);
    }
    
    function setPriceBounds(uint _min, uint _max) external {
        require(msg.sender == owner || msg.sender == oracleAdmin, "unauth");
        require(_min > 0 && _max > _min, "Invalid bounds");
        minAllowedPrice = _min;
        maxAllowedPrice = _max;
    }
    
    
    function getTierCosts() external view returns(uint[18] memory _costs) {
        return AIPViews.getTierCosts(bnbPrice, tierPriceUSD);
    }

    function renounceOwnership() external {
        require(msg.sender == owner, "Not Authorized");
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }

    function transferOwnership(address _newOwner) external {
        require(msg.sender == owner, "Not Authorized");
        require(_newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    /* ================================== */
    /* ================================== */
    /* ========= EVENT REFERENCE ======== */
    /* ================================== */
    
    /**
     * @notice Complete Event List for Frontend Integration
     * 
     * CORE EVENTS:
     * - NodeCreated(address indexed node, uint indexed userId, uint indexed referrerId, uint uplineId)
     * - TierUnlocked(address indexed node, uint indexed userId, uint packageId)
     * - RewardDistributed(address indexed node, uint indexed userId, uint fromId, uint layer, uint amount, uint time, bool isMissed, uint rewardType, uint tier)
     * 
     * PRICE EVENTS:
     * - OraclePriceUpdated(uint newPrice, uint time)
     * - OracleError(address feed, uint time)
     * 
     * ADMIN EVENTS:
     * - OracleAdminUpdated(address indexed newAdmin)
     * - MatrixAdminUpdated(address indexed newAdmin)
     * - AddressUpdated(uint indexed addrType, address indexed newAddress, address indexed oldAddress)
     * - LayersUpdated(uint indexed layerType, uint oldValue, uint newValue)
     * - OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
     * 
     * ADDRESS TYPES (for AddressUpdated event):
     * - 0: feeReceiver
     * - 1: rewardWallet
     * - 2: (removed)
     * - 3: (removed)
     * 
     * LAYER TYPES (for LayersUpdated event):
     * - 0: maxMatrixDepth (matrix admin)
     * - 1: matrixDistDepth (owner)
     * 
     * INCOME TYPES (for RewardDistributed event):
     * - 0: Referral/Sponsor RewardEvent (registration)
     * - 1: Direct RewardEvent (upgrades)
     * - 2: Level RewardEvent (parentId layers)
     * - 3: Binary RewardEvent (matrix)
     */

    /* ================================== */
    /* ====== FRONTEND VIEW HELPERS ===== */
    /* ================================== */

    /**
     * @dev Fetch a single node by ID returning the FULL struct including arrays
     */
    function getNode(uint256 _nodeId) external view returns (Node memory) {
        require(nodes[_nodeId].nodeId != 0, "Node not found");
        return nodes[_nodeId];
    }

    function getNodeByAddress(address _addr) external view returns (Node memory) {
        uint userId = nodeId[_addr];
        require(userId != 0, "Node not found");
        return nodes[userId];
    }

    function getNodeStats(uint _userId) external view returns (
        uint tier,
        uint directCount,
        uint matrixCount,
        uint totalRewards,
        uint totalContribution,
        uint daysActive
    ) {
        return AIPViews.getNodeStats(nodes, rewardInfo, rewardPool, _userId);
    }

    /// @notice [DEPRECATED] Use rescueBNB. Internal routing is now immediate.
    function sweepFeeReceiver() external {
         // No-op. All funds are routed immediately to feeReceiver or rewardPool.
    }

    /**
     * @notice [DEPRECATED] Internal routing is now immediate.
     * @return platformFees   Always 0
     * @return missedRewards  Always 0
     * @return totalPending   Always 0
     */
    function getFeeReceiverBreakdown() external pure returns (
        uint platformFees,
        uint missedRewards,
        uint totalPending
    ) {
        return (0, 0, 0);
    }


    function getTotalIncome(uint _userId) external view returns (uint) {
        return AIPViews.getTotalIncome(rewardInfo, rewardPool, _userId);
    }

    function getIncomeBreakdown(uint _userId) external view returns (
        uint total, uint referral, uint tier,
        uint binary, uint direct, uint lost, uint poolIncome
    ) {
        return AIPViews.getIncomeBreakdown(rewardInfo, rewardPool, _userId);
    }

    function getDirectReferrals(uint _userId) external view returns (uint count) {
        return nodes[_userId].directNodes;
    }

    function getMatrixPosition(uint _userId) external view returns (
        uint uplineId,
        uint leftChild,
        uint rightChild
    ) {
        Node memory node = nodes[_userId];
        uplineId = node.matrixParent;
        
        if (teams[_userId][0].length > 0) {
            leftChild = teams[_userId][0][0];
        }
        if (teams[_userId][0].length > 1) {
            rightChild = teams[_userId][0][1];
        }
    }

    function getTeamSize(uint _userId, uint _depth) external view returns (uint) {
        if (_depth >= layerDepth) {
            _depth = layerDepth - 1;
        }
        return networkTree[_userId][_depth].length;
    }

    function getUserLevel(uint _userId) external view returns (uint) {
        return nodes[_userId].tier;
    }

    function canUpgrade(uint _userId, uint _levels) external view returns (bool) {
        Node memory node = nodes[_userId];
        if (node.nodeId == 0) return false;
        if (node.tier + _levels > 18) return false;
        return true;
    }

    function getUpgradeCost(uint _fromLevel, uint _levels) external view returns (uint totalCost) {
        require(_fromLevel + _levels <= 18, "Exceeds max level");
        
        for (uint i = _fromLevel; i < _fromLevel + _levels; i++) {
            totalCost += getTierCost(i);
        }
    }

    /* ================================== */
    /* === REWARD POOL INTERFACE ======= */
    /* ================================== */
    
    /**
     * @dev Comprehensive data for external reward pool contracts
     * @param _userId Node ID to query
     * @return totalDeposited Total BNB deposited (notional for Genesis)
     * @return directReferrals Count of direct referrals
     * @return totalTeam Total team size at depth 0
     * @return currentLevel Current unlockTier level (1-18)
     * @return directTeamL1 Level 1 direct team count (for 2-direct requirement)
     * @return matrixTeam Total matrix team size
     * @return registrationTime Timestamp of registration
     * @return isActive Whether node is registered (id != 0)
     */
    function getPoolQualificationData(uint _userId) external view returns (
        uint totalDeposited,
        uint directReferrals,
        uint totalTeam,
        uint currentLevel,
        uint directTeamL1,
        uint matrixTeam,
        uint registrationTime,
        bool isActive
    ) {
        return AIPViews.getPoolQualificationData(nodes, networkTree, _userId);
    }

    /**
     * @dev Check if contract ownership has been renounced
     * @return true if owner is zero address (renounced), false otherwise
     */
    function isOwnershipRenounced() external view returns (bool) {
        return owner == address(0);
    }

    /* ===================================================== */
    /* ============== FEERECEIVER ACCOUNTING =============== */
    /* ===================================================== */


    /* ===================================================== */
    /* ============== TRANSPARENCY SECTION ================= */
    /* ===================================================== */

    /**
     * @notice Returns all on-chain transparency metrics in a single call.
     *         Powers the public transparency dashboard — no off-chain trust needed.
     *
     * @return _totalNodes         Total registered Nodes (participants)
     * @return _totalBNBDistributed Total BNB ever distributed to Nodes (wei)
     * @return _totalTiers         Number of active tiers in the protocol (always 18)
     * @return _contractAddress    Address of this deployed contract
     * @return _ownerAddress       Current protocol owner (zero = renounced)
     * @return _isRenounced        True if ownership has been permanently renounced
     */
    function getTransparencyData() external view returns (
        uint  _totalNodes,
        uint  _totalBNBDistributed,
        uint  _totalTiers,
        address _contractAddress,
        address _ownerAddress,
        bool  _isRenounced
    ) {
        _totalNodes          = totalNodes;
        _totalBNBDistributed = totalBNBDistributed;
        _totalTiers          = 18;
        _contractAddress     = address(this);
        _ownerAddress        = owner;
        _isRenounced         = (owner == address(0));
    }

    function getConfig() external view returns (
        uint _defaultRefer,
        uint _totalNodes,
        uint _maxMatrixDepth,
        uint _bnbPrice,
        uint _lastUpdate,
        address _owner,
        address _oracleAdmin,
        address _matrixAdmin,
        address _feeReceiver,
        address _rewardPool,
        uint _maxAllowedPrice,
        uint _minAllowedPrice
    ) {
        return (
            defaultRefer,
            totalNodes,
            maxMatrixDepth,
            bnbPrice,
            lastPriceUpdate,
            owner,
            oracleAdmin,
            matrixAdmin,
            feeReceiver,
            rewardPool,
            maxAllowedPrice,
            minAllowedPrice
        );
    }
}

