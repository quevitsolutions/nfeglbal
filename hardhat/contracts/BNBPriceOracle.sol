// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // LOW-05 Fix: Unified to match all other contracts

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function version() external view returns (uint256);

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract BNBPriceOracle is AggregatorV3Interface {
    int256 private manualPrice;
    uint8 private constant DECIMALS = 8;
    uint256 private manualUpdatedAt;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not Authorized");
        _;
    }

    event PriceSet(int256 indexed price, uint256 timestamp);
    event OwnershipTransferred(address indexed previous, address indexed next);

    /**
     * Network: BSC Testnet (Mock)
     * Initial Price: $656.17 (65617000000)
     */
    constructor() {
        manualPrice = 65617000000;
        manualUpdatedAt = block.timestamp;
        owner = msg.sender;
    }

    /**
     * @notice Set the price manually (Mock function)
     * @param _price New price with 8 decimals (must be > 0)
     */
    function setPrice(int256 _price) external onlyOwner {
        require(_price > 0, "Price must be positive");  // H-04 Fix
        manualPrice = _price;
        manualUpdatedAt = block.timestamp;
        emit PriceSet(_price, block.timestamp);          // L-01 Fix
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(1),          // roundId
            manualPrice,        // answer
            manualUpdatedAt,    // startedAt
            manualUpdatedAt,    // updatedAt
            uint80(1)           // answeredInRound
        );
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            manualPrice,
            manualUpdatedAt,
            manualUpdatedAt,
            uint80(1)
        );
    }

    function decimals() external pure override returns (uint8) {
        return DECIMALS;
    }

    function description() external pure override returns (string memory) {
        return "BNB/USD Mock Oracle";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    /**
     * Returns the latest price (Legacy support)
     */
    function getLatestPrice() public view returns (int256) {
        return manualPrice;
    }
}
