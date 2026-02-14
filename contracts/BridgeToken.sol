// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BridgeValidator.sol";
import "./libraries/MessageLib.sol";

/**
 * @title BridgeToken
 * @dev Wrapped token contract deployed on Polygon Amoy (Destination Chain)
 * @notice Mints wrapped ETH when tokens are bridged from Sepolia
 * 
 * Flow:
 * 1. User locks ETH on Sepolia
 * 2. Relayer detects event and submits to Amoy
 * 3. This contract verifies proof and mints wrapped tokens
 * 4. User receives wETH on Amoy
 * 
 * Reverse Flow (Burn):
 * 1. User calls burn() with amount
 * 2. Contract burns tokens and emits event
 * 3. Relayer submits unlock transaction to Sepolia
 * 4. User receives original ETH on Sepolia
 * 
 * Token Details:
 * - Name: Wrapped Sepolia ETH
 * - Symbol: wSepETH
 * - Decimals: 18 (matches ETH)
 * - Supply: Unlimited (minted on demand)
 */
contract BridgeToken is ERC20, ERC20Burnable, Ownable, Pausable, ReentrancyGuard {
    using MessageLib for MessageLib.BridgeMessage;

    // ============ State Variables ============

    /// @notice Reference to the validator contract
    BridgeValidator public immutable validator;

    /// @notice Chain ID of this chain (Amoy)
    uint256 public immutable destinationChainId;

    /// @notice Chain ID of source chain (Sepolia)
    uint256 public immutable sourceChainId;

    /// @notice Current nonce for burn transactions
    uint256 public currentNonce;

    /// @notice Total amount of tokens minted
    uint256 public totalMinted;

    /// @notice Total amount of tokens burned
    uint256 public totalBurned;

    /// @notice Total number of mint transactions
    uint256 public totalMintTransactions;

    /// @notice Total number of burn transactions
    uint256 public totalBurnTransactions;

    /// @notice Mapping of transaction hashes to prevent duplicates
    mapping(bytes32 => bool) public processedTransactions;

    /// @notice Minimum mint/burn amount (prevents dust)
    uint256 public constant MIN_AMOUNT = 0.001 ether;

    /// @notice Maximum mint amount per transaction
    uint256 public maxMintAmount = 10 ether;

    // ============ Events ============

    /**
     * @dev Emitted when tokens are minted (bridge from Sepolia)
     * @param recipient Address receiving the tokens
     * @param amount Amount of tokens minted
     * @param nonce Transaction nonce from Sepolia
     * @param sourceChainTxHash Transaction hash on Sepolia
     * @param timestamp When minting occurred
     */
    event TokensMinted(
        address indexed recipient,
        uint256 amount,
        uint256 indexed nonce,
        bytes32 indexed sourceChainTxHash,
        uint256 timestamp
    );

    /**
     * @dev Emitted when tokens are burned (bridge back to Sepolia)
     * @param burner Address burning the tokens
     * @param recipient Address that will receive ETH on Sepolia
     * @param amount Amount of tokens burned
     * @param nonce Unique burn nonce
     * @param timestamp When burning occurred
     * @param leafHash Merkle leaf hash for this transaction
     */
    event TokensBurned(
        address indexed burner,
        address indexed recipient,
        uint256 amount,
        uint256 indexed nonce,
        uint256 timestamp,
        bytes32 leafHash
    );

    /**
     * @dev Emitted when max mint amount is updated
     * @param oldMax Previous maximum
     * @param newMax New maximum
     */
    event MaxMintAmountUpdated(uint256 oldMax, uint256 newMax);

    // ============ Errors ============

    error InsufficientAmount();
    error ExceedsMaximum();
    error InvalidRecipient();
    error TransactionAlreadyProcessed();
    error InvalidProof();
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @dev Initializes the bridge token
     * @param _validator Address of the validator contract
     * @param _sourceChainId Chain ID of Sepolia
     */
    constructor(
        address _validator,
        uint256 _sourceChainId
    ) ERC20("Wrapped Sepolia ETH", "wSepETH") Ownable(msg.sender) {
        if (_validator == address(0)) revert ZeroAddress();
        
        validator = BridgeValidator(_validator);
        destinationChainId = block.chainid;
        sourceChainId = _sourceChainId;
        currentNonce = 1; // Start from 1
    }

    // ============ External Functions ============

    /**
     * @dev Mints tokens when ETH is bridged from Sepolia
     * @param sender Original sender on Sepolia
     * @param recipient Address to receive tokens on Amoy
     * @param amount Amount to mint
     * @param nonce Transaction nonce from Sepolia
     * @param timestamp Transaction timestamp from Sepolia
     * @param sourceChainTxHash Transaction hash on Sepolia
     * @param proof Merkle proof
     * @param root Merkle root
     * 
     * Requirements:
     * - Valid Merkle proof
     * - Nonce not already used
     * - Amount within limits
     * - Contract must not be paused
     * 
     * This function can be called by anyone (typically the relayer)
     * Security is ensured through Merkle proof verification
     */
    function mint(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp,
        bytes32 sourceChainTxHash,
        bytes32[] memory proof,
        bytes32 root
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < MIN_AMOUNT) revert InsufficientAmount();
        if (amount > maxMintAmount) revert ExceedsMaximum();

        // Generate leaf hash
        bytes32 leafHash = MessageLib.generateLeafHash(
            sender,
            recipient,
            amount,
            nonce,
            sourceChainId,  // Source is Sepolia
            destinationChainId, // Destination is Amoy
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
            sourceChainId,
            destinationChainId,
            timestamp,
            proof,
            root
        );

        if (!isValid) revert InvalidProof();

        // Mark as processed
        processedTransactions[leafHash] = true;

        // Update state
        totalMinted += amount;
        totalMintTransactions++;

        // Mint tokens to recipient
        _mint(recipient, amount);

        emit TokensMinted(
            recipient,
            amount,
            nonce,
            sourceChainTxHash,
            block.timestamp
        );
    }

    /**
     * @dev Burns tokens to bridge back to Sepolia
     * @param amount Amount of tokens to burn
     * @param recipient Address that will receive ETH on Sepolia
     * 
     * Requirements:
     * - Caller must have sufficient balance
     * - Amount must be >= MIN_AMOUNT
     * - Recipient cannot be zero address
     * - Contract must not be paused
     * 
     * Emits:
     * - TokensBurned event for relayer to detect
     */
    function burnForBridge(
        uint256 amount,
        address recipient
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < MIN_AMOUNT) revert InsufficientAmount();
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Get current nonce and increment
        uint256 nonce = currentNonce++;
        uint256 timestamp = block.timestamp;

        // Generate leaf hash for Merkle tree
        bytes32 leafHash = MessageLib.generateLeafHash(
            msg.sender,
            recipient,
            amount,
            nonce,
            destinationChainId, // Source is Amoy for burn
            sourceChainId,      // Destination is Sepolia
            timestamp
        );

        // Update state
        totalBurned += amount;
        totalBurnTransactions++;
        processedTransactions[leafHash] = true;

        // Burn tokens
        _burn(msg.sender, amount);

        // Emit event for relayer
        emit TokensBurned(
            msg.sender,
            recipient,
            amount,
            nonce,
            timestamp,
            leafHash
        );
    }

    // ============ Admin Functions ============

    /**
     * @dev Updates the maximum mint amount
     * @param newMax New maximum amount
     * 
     * Requirements:
     * - Caller must be owner
     * - New max must be >= MIN_AMOUNT
     */
    function updateMaxMintAmount(uint256 newMax) external onlyOwner {
        require(newMax >= MIN_AMOUNT, "Max too low");
        
        uint256 oldMax = maxMintAmount;
        maxMintAmount = newMax;

        emit MaxMintAmountUpdated(oldMax, newMax);
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

    // ============ View Functions ============

    /**
     * @dev Returns token statistics
     * @return minted Total tokens minted
     * @return burned Total tokens burned
     * @return supply Current total supply
     * @return mintTxs Total mint transactions
     * @return burnTxs Total burn transactions
     * @return nonce Current nonce
     */
    function getStats() external view returns (
        uint256 minted,
        uint256 burned,
        uint256 supply,
        uint256 mintTxs,
        uint256 burnTxs,
        uint256 nonce
    ) {
        return (
            totalMinted,
            totalBurned,
            totalSupply(),
            totalMintTransactions,
            totalBurnTransactions,
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
     * @dev Generates a leaf hash for a potential mint transaction
     * @param sender Sender address on Sepolia
     * @param recipient Recipient address on Amoy
     * @param amount Amount
     * @param nonce Nonce
     * @param timestamp Timestamp
     * @return bytes32 The leaf hash
     */
    function previewMintLeafHash(
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

    /**
     * @dev Generates a leaf hash for a potential burn transaction
     * @param burner Burner address on Amoy
     * @param recipient Recipient address on Sepolia
     * @param amount Amount
     * @param nonce Nonce
     * @param timestamp Timestamp
     * @return bytes32 The leaf hash
     */
    function previewBurnLeafHash(
        address burner,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    ) external view returns (bytes32) {
        return MessageLib.generateLeafHash(
            burner,
            recipient,
            amount,
            nonce,
            destinationChainId,
            sourceChainId,
            timestamp
        );
    }

    // ============ Overrides ============

    /**
     * @dev Hook that is called before any transfer of tokens
     * @param from Address tokens are transferred from
     * @param to Address tokens are transferred to
     * @param amount Amount of tokens
     * 
     * Ensures contract is not paused during transfers
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._update(from, to, amount);
    }
}

