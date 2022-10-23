//SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error Vault__PriceTooLow();
error Vault__DepositNotStarted();
error Vault__DepositEnded();
error Vault__WithdrawOnlyAvailableAfterEndTime(uint256 duration);
error Vault__RollOptionsOnlyAvailableAfterBufferTime();
error Vault__DepositAmountMustBeAboveZero();

/**
 * @title Vault
 * @author github.com/dindonero
 * @notice A simplified contract of a covered call DeFi options vault.
 * @notice The vault does not do any settlement (distribution of profits/return of collateral at the time of expiry).
 * @notice Users can also deposit the underlying asset into the vault to earn interest.
 * @dev The contract is designed to be used with a proxy contract.
 */
contract Vault is Initializable, Ownable {
    struct Option {
        address owner;
        uint256 amount;
        uint256 strikePrice;
        uint256 expiry;
    }

    // Events
    event Deposit(address indexed depositor, uint256 indexed amount);

    event Withdraw(address indexed depositor, uint256 indexed amount);

    event OptionBought(
        uint256 indexed optionId,
        address indexed depositor,
        uint256 indexed strikePrice,
        uint256 amount,
        uint256 expiry
    );

    // Local Variables
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    IERC20 public UNDERLYING_ASSET;

    IUniswapV2Router01 public EXCHANGE;

    uint256 public limitPrice;

    mapping(uint256 => Option) public options;

    uint256 public optionsCounter;

    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    uint256 public START_TIME;
    uint256 public END_TIME;
    uint256 public BUFFER_TIME;

    AggregatorV3Interface private priceFeed;

    bool private initialized;

    /**
     * @notice Initializes the contract.
     * @dev The contract must be initialized only once.
     * @dev It works as the constructor but it is used with a proxy contract.
     * @param UNDERLYING_ASSET_ADDRESS The address of the underlying asset.
     * @param EXCHANGE_ADDRESS The address of the Uniswap exchange.
     * @param _START_TIME The start time of the deposit period.
     * @param _END_TIME The end time of the deposit period.
     * @param _BUFFER_TIME The buffer time after the deposit period ends.
     * @param priceFeedAddress The address of the price feed.
     */
    function initialize(
        address UNDERLYING_ASSET_ADDRESS,
        address EXCHANGE_ADDRESS,
        uint256 _START_TIME,
        uint256 _END_TIME,
        uint256 _BUFFER_TIME,
        address priceFeedAddress
    ) public initializer {
        require(!initialized, "Contract instance has already been initialized");
        initialized = true;
        limitPrice = 1000;
        UNDERLYING_ASSET = IERC20(UNDERLYING_ASSET_ADDRESS);
        EXCHANGE = IUniswapV2Router01(EXCHANGE_ADDRESS);
        START_TIME = block.timestamp + _START_TIME;
        END_TIME = block.timestamp + _END_TIME;
        BUFFER_TIME = _BUFFER_TIME;
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        optionsCounter = 0;
        _transferOwnership(msg.sender);
    }

    /**
     * @notice Sells call options to users.
     * @dev The USDC amount must have been approved to this contract prior to its execution.
     * @param amount The amount of underlying asset to deposit.
     * @param price The strike price of the option.
     */
    function buyOption(uint256 amount, uint256 price) public {
        if (price <= limitPrice) revert Vault__PriceTooLow();

        USDC.transferFrom(msg.sender, address(this), amount);
        USDC.approve(address(EXCHANGE), USDC.balanceOf(address(this)));

        uint256 optionId = optionsCounter;
        options[optionId] = Option(msg.sender, amount, price, END_TIME);
        optionsCounter++;
        emit OptionBought(optionId, msg.sender, amount, price, END_TIME);
    }

    /**
     * @notice Deposits the underlying asset into the vault in order to earn interest.
     * @dev The underlying asset must have been approved to this contract prior to its execution by each user.
     * @param amount The amount of underlying asset to deposit.
     */
    function depositAssets(uint256 amount) public {
        if (block.timestamp < START_TIME) revert Vault__DepositNotStarted();
        if (block.timestamp > END_TIME) revert Vault__DepositEnded();
        if (amount == 0) revert Vault__DepositAmountMustBeAboveZero();

        uint256 shares;
        if (totalSupply == 0) shares = amount;
        else shares = (amount * totalSupply) / UNDERLYING_ASSET.balanceOf(address(this));

        _mint(msg.sender, shares);
        UNDERLYING_ASSET.transferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Withdraws the underlying asset from the vault with interest.
     * @dev The contract is safe from Reentrancy Vulnerabilities as it updates the balances before transferring the assets.
     */
    function withdrawAssets() public {
        if (block.timestamp < END_TIME)
            revert Vault__WithdrawOnlyAvailableAfterEndTime(END_TIME - block.timestamp);

        uint256 shares = balances[msg.sender];
        uint256 amountWETH = (shares * UNDERLYING_ASSET.balanceOf(address(this))) / totalSupply;
        uint256 amountUSDC = (shares * USDC.balanceOf(address(this))) / totalSupply;

        _burn(msg.sender, shares);
        UNDERLYING_ASSET.transfer(msg.sender, amountWETH);
        USDC.transfer(msg.sender, amountUSDC);

        emit Withdraw(msg.sender, amountWETH);
    }

    function setLimitPrice(uint256 price) public onlyOwner {
        limitPrice = price;
    }

    function rollOptionsVault(uint256 _START_TIME, uint256 _END_TIME) public onlyOwner {
        if (block.timestamp < END_TIME + BUFFER_TIME)
            revert Vault__RollOptionsOnlyAvailableAfterBufferTime();

        // Set new start and end time
        START_TIME = _START_TIME;
        END_TIME = _END_TIME;

        address[] memory path = new address[](2);
        path[0] = address(UNDERLYING_ASSET);
        path[1] = address(USDC);

        // Swap all USDC to WETH
        EXCHANGE.swapExactTokensForTokens(
            USDC.balanceOf(address(this)),
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function _mint(address account, uint256 amount) internal {
        totalSupply += amount;
        balances[account] += amount;
    }

    function _burn(address account, uint256 amount) internal {
        totalSupply -= amount;
        balances[account] -= amount;
    }

    function getLatestPrice() public view returns (int256) {
        (
            ,
            /*uint80 roundID*/
            int256 price, /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/
            ,
            ,

        ) = priceFeed.latestRoundData();
        return price;
    }

    function getOption(uint256 optionId) public view returns (Option memory) {
        return options[optionId];
    }
}
