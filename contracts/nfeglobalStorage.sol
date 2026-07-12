// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Infeglobal.sol";

contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED);
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

abstract contract nfeglobalStorage is ReentrancyGuard {
    error NodeNotExist();
    error TransferFailed();
    error InvalidNode();

    Infeglobal.ChainConfig public config;

    uint256 internal constant baseDivider = 10000;
    uint256 internal constant TRANSFER_GAS_LIMIT = 100000;
    uint256 public immutable defaultRefer;
    address public feeReceiver;
    address public rewardPool;
    address public oracleAdmin;
    address public matrixAdmin;

    uint256 public registrationFeeUSD = 7e17; // 0.70 USD

    mapping(uint256 => bool) public isFreeRegistered;
    uint256 public totalFreeUsers;
    uint256 public totalFreeUpgraded;
    mapping(uint256 => uint256) public totalTreasuryUsed;

    mapping(uint256 => mapping(uint256 => uint256)) public levelFreeCount;
    mapping(uint256 => mapping(uint256 => uint256)) public levelPaidCount;
    mapping(uint256 => mapping(uint256 => uint256)) public levelTreasuryGenerated;
    mapping(uint256 => mapping(uint256 => uint256)) public levelTreasuryUsed;
    mapping(uint256 => mapping(uint256 => uint256)) public levelRewardsDistributed;
    mapping(uint256 => uint256) public teamTotalUpgrades;

    string public nativeTokenSymbol;
    uint256 public nativeTokenPrice;
    uint256 public lastPriceUpdate;
    uint256 public maxAllowedPrice;
    uint256 public minAllowedPrice;
    uint256 public lastOracleRoundTime;
    uint256 internal lastManualPriceUpdate;

    uint256 public queueHead;
    uint256 public queueTail;
    mapping(uint256 => uint256) public queue;
    mapping(uint256 => bool) public inTreasuryQueue;
    mapping(uint256 => uint256) public queuedTier;
    mapping(uint256 => uint256) public queuedCostBNB;
    mapping(uint256 => uint256) public lastTreasuryActivity;

    bool public oracleCircuitBreaker;
    uint256 public circuitBreakerActivatedAt;

    mapping(uint256 => uint256) public matrixDepth;
    mapping(uint256 => uint256) public minVacancyDepth;


    uint256 internal constant MAX_PRICE_DEVIATION = 2000;
    uint256 internal constant MAX_MANUAL_PRICE_DEVIATION = 5000;

    uint256 internal constant ORACLE_HEARTBEAT = 28 hours;
    uint256 internal constant PRICE_STALENESS_THRESHOLD = 27 hours;


    uint256 public maxMatrixDepth = 25;
    uint256 internal constant directPercent = 1000;
    uint256 internal constant layerDepth = 10;
    uint256 internal constant minDirectNodes = 2;

    uint256 internal constant cyclicPercent = 7000;
    uint256 internal constant rewardPoolPercent = 500;

    uint256[18] public tierPriceUSD = [
        5e18,
        5e18,
        10e18,
        20e18,
        40e18,
        80e18,
        160e18,
        320e18,
        640e18,
        1280e18,
        2560e18,
        5120e18,
        10240e18,
        20480e18,
        40960e18,
        81920e18,
        163840e18,
        327680e18
    ];

    uint256 public totalNodes;
    uint256 public totalBNBDistributed;
    uint256 public _nextId;
    address public viewsContract;
    uint256[] public globalNodes;
    mapping(uint256 => Infeglobal.Node) public nodes;
    mapping(uint256 => Infeglobal.RewardInfo) public rewardInfo;
    mapping(uint256 => Infeglobal.RewardEvent[]) public rewardHistory;
    mapping(uint256 => mapping(uint256 => uint256[])) public teams;
    mapping(uint256 => mapping(uint256 => uint256[])) public networkTree;
    mapping(uint256 => uint256) public matrixChildCount;
    mapping(address => uint256) public nodeId;
    mapping(uint256 => mapping(uint256 => uint256)) public nodeDayReward;

    mapping(address => uint256) public pendingReward;
    mapping(uint256 => uint256) public treasuryBalance;
    uint256 public totalTreasuryBalance;
    uint256 public totalPendingRewards;
    mapping(uint256 => Infeglobal.AccountBalance) public accountBalances;
    // Reserved for future qualification-engine upgrades.
    // Not used by treasury-based progression.
    mapping(uint256 => mapping(uint8 => uint256)) public tierVault;
    address public owner;

    // Configurable treasury queue batch processing size (appended at the end to preserve upgrade storage layout)
    uint256 public autoBatch = 1;

    // ── Governance (appended — upgrade-safe) ────────────────────────────────
    // The governor controls critical parameter changes via a timelocked
    // NFEGovernance contract. Initially address(0); set once by owner.
    address public governor;

    // Dormancy: nodes inactive beyond dormancyPeriod have their treasury swept
    uint256 public dormancyPeriod = 1095 days; // 3 years default

    // Dormancy distribution basis points (must sum to 10 000)
    uint256 public dormancyRewardPoolBP = 7000; // 70% → Reward Pool
    uint256 public dormancyDAOBP        = 2000; // 20% → DAO Treasury
    uint256 public dormancyFeeRecBP     = 1000; // 10% → Fee Receiver

    // DAO Treasury address — receives dormancy DAO share
    address public daoTreasury;

    address public incomeVault;

    // ── ICE System (appended — upgrade-safe) ─────────────────────────────────
    // NFECycleManager — tracks subscription lifecycle flags (no tree duplication)
    address public cycleManager;

    // NFERenewalEngine — executes annual renewals and funding priority logic
    address public renewalEngine;

    // FounderPool and LeaderboardPool for V3 bonus ecosystem
    address public founderPool;
    address public leaderboardPool;

    // Queue safety upgrade block mapping
    mapping(uint256 => uint40) public lastUpgradeBlock;

    event FounderPoolUpdated(address indexed oldFP, address indexed newFP);
    event LeaderboardPoolUpdated(address indexed oldLP, address indexed newLP);
    event IncomeVaultUpdated(address indexed oldVault, address indexed newVault);
    event CycleManagerUpdated(address indexed oldCM, address indexed newCM);
    event RenewalEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event RenewalDistributed(uint256 indexed nodeId, uint256 cost, uint256 timestamp);

    event NodeCreated(
        address indexed wallet,
        uint indexed nodeId,
        uint indexed sponsorId,
        uint matrixParentId
    );
    event TierUnlocked(address indexed wallet, uint indexed nodeId, uint tierId);
    event RewardDistributed(
        address indexed wallet,
        uint indexed nodeId,
        uint fromId,
        uint layer,
        uint amount,
        uint time,
        bool isMissed,
        uint rewardType,
        uint tier
    );
    event OraclePriceUpdated(uint newPrice, uint time);
    event OracleError(address indexed feed, uint time);
    event OracleDeviationTooHigh(uint indexed oldPrice, uint indexed newPrice, uint deviation, uint timestamp);
    event RewardPending(address indexed recipient, uint amount);
    event OracleAdminUpdated(address indexed newAdmin);
    event MatrixAdminUpdated(address indexed newAdmin);
    event AddressUpdated(uint indexed addrType, address indexed newAddress, address indexed oldAddress);
    event LayersUpdated(uint indexed layerType, uint oldValue, uint newValue);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeReceiverSwept(uint platformFees, uint missedRewards, uint total);
    event DustSwept(uint amount, address indexed pool, uint timestamp);
    event PoolCheckRequired(uint indexed nodeId, uint timestamp);
    event MatrixFallback(uint indexed nodeId, uint indexed sponsor, uint timestamp);
    event TreasuryNodeQueued(uint indexed nodeId, uint tier);
    event TreasuryUpgradeExecuted(uint indexed nodeId, uint oldTier, uint newTier, uint treasuryAmount);
    event TreasuryQueueProcessed(uint indexed nodeId, uint remainingQueueSize);
    event PriceBoundsUpdated(uint oldMin, uint oldMax, uint newMin, uint newMax);
    event AutoBatchUpdated(uint256 newBatch);

    // Governance events
    event GovernorSet(address indexed oldGovernor, address indexed newGovernor);
    event DormantNodeSwept(uint indexed nodeId, uint rewardPoolAmt, uint daoAmt, uint feeAmt);
    event DormancyPeriodUpdated(uint oldPeriod, uint newPeriod);
    event DormancyDistributionUpdated(uint rpBP, uint daoBP, uint feeBP);
    event DaoTreasuryUpdated(address indexed oldAddr, address indexed newAddr);

    event TreasuryCredited(uint indexed nodeId, uint amount, uint balance);

    event TreasuryUsed(
        uint indexed nodeId,
        uint amount,
        uint remainingBalance
    );
    event OracleCircuitBreakerTriggered(
        uint oldPrice,
        uint newPrice,
        uint deviation
    );
    event Tier18TreasuryReleased(
        uint indexed nodeId,
        uint amount
    );
    event UpgradeReady(
        uint indexed nodeId,
        uint tier,
        uint treasury
    );

    function _checkOwner() internal view {
        require(msg.sender == owner);
    }
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    function _checkOwnerOrOracleAdmin() internal view {
        require(msg.sender == owner || msg.sender == oracleAdmin);
    }
    modifier onlyOwnerOrOracleAdmin() {
        _checkOwnerOrOracleAdmin();
        _;
    }
    function _checkOwnerOrMatrixAdmin() internal view {
        require(msg.sender == owner || msg.sender == matrixAdmin);
    }
    modifier onlyOwnerOrMatrixAdmin() {
        _checkOwnerOrMatrixAdmin();
        _;
    }
    function _checkGovernor() internal view {
        require(msg.sender == governor || msg.sender == owner);
    }
    modifier onlyGovernor() {
        _checkGovernor();
        _;
    }


    constructor(uint256 _defaultRefer) {
        defaultRefer = _defaultRefer;
    }
}
