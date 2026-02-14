// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BridgeValidator.sol";
import "./libraries/MessageLib.sol";

/**
 * @title BridgeVault
 * @dev Vault contract deployed on Ethereum Sepolia (Source Chain)
 * @notice Locks ETH and emits events for cross-chain bridging
 * 
 * Flow:
 * 1. User calls lock() with ETH
 * 2. Contract locks ETH and emits BridgingInitiated event
 * 3. Relayer detects event and submits to Amoy
 * 4. User receives wrapped tokens on Amoy
 * 
 * Reverse Flow (Unlock):
 * 1. User burns tokens on Amoy
 * 2. Relayer submits unlock transaction with proof
 * 3. Contract verifies proof and releases ETH
 * 
 * Security:
 * - ReentrancyGuard prevents reentrancy attacks
 * - Pausable for emergency stops
 * - Merkle proof verification for unlocks
 * - Nonce system prevents double-spending
 */
contract BridgeVault is Ownable, Pausable, ReentrancyGuard {
    using MessageLib for MessageLib.BridgeMessage;

    // ============ State Variables ============

    /// @notice Reference to the validator contract
    BridgeValidator public immutable validator;

    /// @notice Chain ID of this chain (Sepolia)
    uint256 public immutable sourceChainId;

    /// @notice Chain ID of destination chain (Amoy)
    uint256 public immutable destinationChainId;

    /// @notice Current nonce for bridge transactions
    uint256 public currentNonce;

    /// @notice Total amount of ETH locked in the vault
    uint256 public totalLocked;

    /// @notice Total amount of ETH unlocked from the vault
    uint256 public totalUnlocked;

    /// @notice Total number of bridge transactions
    uint256 public totalBridgeTransactions;

    /// @notice Minimum bridge amount (prevents dust attacks)
    uint256 public constant MIN_BRIDGE_AMOUNT = 0.001 ether;

    /// @notice Maximum bridge amount (security limit)
    uint256 public maxBridgeAmount = 10 ether;

    /// @notice Mapping of transaction hashes to prevent duplicates
    mapping(bytes32 => bool) public processedTransactions;

    // ============ Events ============

    /**
     * @dev Emitted when ETH is locked for bridging
     * @param sender Address that locked the ETH
     * @param recipient Address that will receive on destination chain
     * @param amount Amount of ETH locked
     * @param nonce Unique transaction nonce
     * @param timestamp When the lock occurred
     * @param leafHash Merkle leaf hash for this transaction
     */
    event BridgingInitiated(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 indexed nonce,
        uint256 timestamp,
        bytes32 leafHash
    );

    /**
     * @dev Emitted when ETH is unlocked (bridge back from Amoy)
     * @param recipient Address receiving the unlocked ETH
     * @param amount Amount of ETH unlocked
     * @param nonce Transaction nonce
     * @param timestamp When the unlock occurred
     */
    event BridgingCompleted(
        address indexed recipient,
        uint256 amount,
        uint256 indexed nonce,
        uint256 timestamp
    );

    /**
     * @dev Emitted when max bridge amount is updated
     * @param oldMax Previous maximum
     * @param newMax New maximum
     */
    event MaxBridgeAmountUpdated(uint256 oldMax, uint256 newMax);

    /**
     * @dev Emitted when emergency withdrawal occurs
     * @param recipient Address receiving the funds
     * @param amount Amount withdrawn
     */
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    // ============ Errors ============

    error InsufficientAmount();
    error ExceedsMaximum();
    error TransferFailed();
    error InvalidRecipient();
    error TransactionAlreadyProcessed();
    error InvalidProof();
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @dev Initializes the bridge vault
     * @param _validator Address of the validator contract
     * @param _destinationChainId Chain ID of Amoy
     */
    constructor(
        address _validator,
        uint256 _destinationChainId
    ) Ownable(msg.sender) {
        if (_validator == address(0)) revert ZeroAddress();
        
        validator = BridgeValidator(_validator);
        sourceChainId = block.chainid;
        destinationChainId = _destinationChainId;
        currentNonce = 1; // Start from 1 (0 is reserved)
    }

    // ============ External Functions ============

    /**
     * @dev Locks ETH for bridging to Amoy
     * @param recipient Address that will receive tokens on Amoy
     * 
     * Requirements:
     * - Amount must be >= MIN_BRIDGE_AMOUNT
     * - Amount must be <= maxBridgeAmount
     * - Recipient cannot be zero address
     * - Contract must not be paused
     * 
     * Emits:
     * - BridgingInitiated event with transaction details
     */
    function lock(address recipient) external payable whenNotPaused nonReentrant {
        uint256 amount = msg.value;

        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < MIN_BRIDGE_AMOUNT) revert InsufficientAmount();
        if (amount > maxBridgeAmount) revert ExceedsMaximum();

        // Get current nonce and increment
        uint256 nonce = currentNonce++;
        uint256 timestamp = block.timestamp;

        // Generate leaf hash for Merkle tree
        bytes32 leafHash = MessageLib.generateLeafHash(
            msg.sender,
            recipient,
            amount,
            nonce,
            sourceChainId,
            destinationChainId,
            timestamp
        );

        // Update state
        totalLocked += amount;
        totalBridgeTransactions++;
        processedTransactions[leafHash] = true;

        // Emit event for relayer to detect
        emit BridgingInitiated(
            msg.sender,
            recipient,
            amount,
            nonce,
            timestamp,
            leafHash
        );
    }

    /**
     * @dev Unlocks ETH when bridging back from Amoy
     * @param sender Original sender on Amoy
     * @param recipient Address to receive ETH on Sepolia
     * @param amount Amount to unlock
     * @param nonce Transaction nonce from Amoy
     * @param timestamp Transaction timestamp from Amoy
     * @param proof Merkle proof
     * @param root Merkle root
     * 
     * Requirements:
     * - Valid Merkle proof
     * - Nonce not already used
     * - Sufficient balance in vault
     * - Contract must not be paused
     * 
     * Security:
     * - Validates proof through BridgeValidator
     * - Prevents replay attacks via nonce
     * - ReentrancyGuard prevents reentrancy
     */
    function unlock(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp,
        bytes32[] memory proof,
        bytes32 root
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InsufficientAmount();

        // Generate leaf hash
        bytes32 leafHash = MessageLib.generateLeafHash(
            sender,
            recipient,
            amount,
            nonce,
            destinationChainId, // Source is Amoy for unlock
            sourceChainId,      // Destination is Sepolia
            timestamp
        );

        // Check if already processed
        if (processedTransactions[leafHash]) {
            revert TransactionAlreadyProcessed();
        }

        // Validate transaction through validator
        bool isValid = validator.validateTransaction(
            sender,
            recipient,
            amount,
            nonce,
            destinationChainId,
            sourceChainId,
            timestamp,
            proof,
            root
        );

        if (!isValid) revert InvalidProof();

        // Mark as processed
        processedTransactions[leafHash] = true;

        // Update state
        totalUnlocked += amount;

        // Transfer ETH to recipient
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit BridgingCompleted(recipient, amount, nonce, block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @dev Updates the maximum bridge amount
     * @param newMax New maximum amount
     * 
     * Requirements:
     * - Caller must be owner
     * - New max must be >= MIN_BRIDGE_AMOUNT
     */
    function updateMaxBridgeAmount(uint256 newMax) external onlyOwner {
        require(newMax >= MIN_BRIDGE_AMOUNT, "Max too low");
        
        uint256 oldMax = maxBridgeAmount;
        maxBridgeAmount = newMax;

        emit MaxBridgeAmountUpdated(oldMax, newMax);
    }

    /**
     * @dev Pauses the contract (emergency stop)
     * 
     * Requirements:
     * - Caller must be owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     * 
     * Requirements:
     * - Caller must be owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal function
     * @param recipient Address to receive the funds
     * @param amount Amount to withdraw
     * 
     * Requirements:
     * - Caller must be owner
     * - Contract must be paused
     * 
     * WARNING: Only use in extreme emergencies
     * This breaks the bridge invariant and should trigger
     * a migration to a new contract
     */
    function emergencyWithdraw(
        address payable recipient,
        uint256 amount
    ) external onlyOwner whenPaused {
        if (recipient == address(0)) revert InvalidRecipient();
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit EmergencyWithdrawal(recipient, amount);
    }

    // ============ View Functions ============

    /**
     * @dev Returns the contract balance
     * @return uint256 Current ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Returns vault statistics
     * @return locked Total ETH locked
     * @return unlocked Total ETH unlocked
     * @return balance Current balance
     * @return transactions Total bridge transactions
     * @return nonce Current nonce
     */
    function getStats() external view returns (
        uint256 locked,
        uint256 unlocked,
        uint256 balance,
        uint256 transactions,
        uint256 nonce
    ) {
        return (
            totalLocked,
            totalUnlocked,
            address(this).balance,
            totalBridgeTransactions,
            currentNonce
        );
    }

    /**
     * @dev Checks if a transaction has been processed
     * @param leafHash The transaction leaf hash
     * @return bool True if processed
     */
    function isTransactionProcessed(bytes32 leafHash) external view returns (bool) {
        return processedTransactions[leafHash];
    }

    /**
     * @dev Returns contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Generates a leaf hash for a potential transaction
     * @param sender Sender address
     * @param recipient Recipient address
     * @param amount Amount
     * @param nonce Nonce
     * @param timestamp Timestamp
     * @return bytes32 The leaf hash
     */
    function previewLeafHash(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    ) external view returns (bytes32) {
        return MessageLib.generateLeafHash(
            sender,
            recipient,
            amount,
            nonce,
            sourceChainId,
            destinationChainId,
            timestamp
        );
    }

    // ============ Receive Function ============

    /**
     * @dev Fallback function to receive ETH
     * Note: Direct ETH transfers don't initiate bridging
     * Use lock() function instead
     */
    receive() external payable {
        // Accept ETH but don't bridge
        // This allows refilling the vault if needed
    }
}

