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
    error AlreadyProposed();
    error AlreadyDormant();
    error NotInactiveLongEnough();
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
    address public governance;
    uint256 public constant CLAIM_PERIOD = 30 days;
    uint256 public dormancyThreshold = 1095 days;

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
    mapping(uint256 => bool) public treasuryDormant;
    mapping(uint256 => uint256) public dormantStart;
    mapping(uint256 => bool) public dormancyProposed;
    mapping(uint256 => uint256) public dormancyProposalTime;

    bool public oracleCircuitBreaker;
    uint256 public circuitBreakerActivatedAt;

    mapping(uint256 => uint256) public matrixDepth;
    mapping(uint256 => uint256) public minVacancyDepth;

    uint256 public constant AUTO_BATCH = 1;

    uint256 internal constant MAX_PRICE_DEVIATION = 2000;
    uint256 internal constant MAX_MANUAL_PRICE_DEVIATION = 5000;

    uint256 internal constant ORACLE_HEARTBEAT = 28 hours;
    uint256 internal constant PRICE_STALENESS_THRESHOLD = 27 hours;
    uint256 internal rescueTimeLock;
    uint256 internal constant RESCUE_DELAY = 48 hours;

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
    bool public migrationLocked;
    address public owner;
    address public migrationHelper;

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
    event RescueScheduled(uint executeAfter);
    event DustSwept(uint amount, address indexed pool, uint timestamp);
    event PoolCheckRequired(uint indexed nodeId, uint timestamp);
    event MatrixFallback(uint indexed nodeId, uint indexed sponsor, uint timestamp);
    event TreasuryNodeQueued(uint indexed nodeId, uint tier);
    event TreasuryUpgradeExecuted(uint indexed nodeId, uint oldTier, uint newTier, uint treasuryAmount);
    event TreasuryQueueProcessed(uint indexed nodeId, uint remainingQueueSize);
    event PriceBoundsUpdated(uint oldMin, uint oldMax, uint newMin, uint newMax);

    event TreasuryCredited(uint indexed nodeId, uint amount, uint balance);
    event TreasuryDormant(uint indexed nodeId, uint amount, uint timestamp);
    event DormancyRecovered(uint indexed nodeId);
    event DormantTreasuryTransferred(uint indexed nodeId, uint amount);
    event DaoSpendingExecuted(address indexed target, uint amount, string purpose);
    event DormancyThresholdUpdated(uint oldVal, uint newVal);
    event TreasuryAbandoned(uint256 indexed nodeId, address indexed recipient, uint256 amount);

    event TreasuryUsed(
        uint indexed nodeId,
        uint amount,
        uint remainingBalance
    );
    event DaoTreasuryIncreased(
        uint indexed nodeId,
        uint amount,
        uint newDaoTreasuryBalance
    );
    event DaoTreasuryDecreased(
        address indexed receiver,
        uint amount,
        uint remainingDaoTreasury
    );
    event DormancyProposed(
        uint indexed nodeId,
        uint timestamp
    );
    event DormancyActivated(
        uint indexed nodeId,
        uint timestamp
    );
    event DaoProposalCreated(
        uint proposalId,
        address target,
        uint amount,
        uint executeAfter
    );
    event DaoProposalExecuted(
        uint proposalId
    );
    event OracleCircuitBreakerTriggered(
        uint oldPrice,
        uint newPrice,
        uint deviation
    );
    event DustSkimmed(
        uint amount,
        address rewardPool
    );
    event MigrationLocked();
    event Tier18TreasuryReleased(
        uint indexed nodeId,
        uint amount
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
    function _checkGovernance() internal view {
        require(msg.sender == governance);
    }
    modifier onlyGovernance() {
        _checkGovernance();
        _;
    }

    constructor(uint256 _defaultRefer) {
        defaultRefer = _defaultRefer;
    }
}
