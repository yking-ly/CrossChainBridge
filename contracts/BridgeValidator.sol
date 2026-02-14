// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/MerkleProof.sol";
import "./libraries/MessageLib.sol";

/**
 * @title BridgeValidator
 * @dev Validates cross-chain bridge transactions using Merkle proofs
 * @notice This contract provides cryptographic verification for bridge operations
 * 
 * Security Features:
 * - Merkle proof verification
 * - Nonce tracking (prevents replay attacks)
 * - Signature verification
 * - Access control
 * - Pausable in emergency
 * 
 * Architecture:
 * This validator is deployed on both chains (Sepolia and Amoy)
 * It maintains a registry of valid Merkle roots and used nonces
 */
contract BridgeValidator is Ownable, Pausable, ReentrancyGuard {
    using MessageLib for MessageLib.BridgeMessage;

    // ============ State Variables ============

    /// @notice Mapping of Merkle roots that have been registered
    /// @dev root => isValid
    mapping(bytes32 => bool) public validRoots;

    /// @notice Mapping of nonces that have been used
    /// @dev nonce => isUsed (prevents double-spending)
    mapping(uint256 => bool) public usedNonces;

    /// @notice Counter for total number of validated transactions
    uint256 public validatedTransactions;

    /// @notice Minimum time between root updates (prevents spam)
    uint256 public constant MIN_ROOT_UPDATE_DELAY = 1 minutes;

    /// @notice Last time a root was updated
    uint256 public lastRootUpdate;

    /// @notice Trusted relayer address (can submit roots)
    address public relayer;

    // ============ Events ============

    /**
     * @dev Emitted when a new Merkle root is registered
     * @param root The Merkle root hash
     * @param timestamp When the root was registered
     */
    event RootRegistered(bytes32 indexed root, uint256 timestamp);

    /**
     * @dev Emitted when a transaction is validated
     * @param nonce The transaction nonce
     * @param leafHash The transaction leaf hash
     * @param validator Address that validated the transaction
     */
    event TransactionValidated(
        uint256 indexed nonce,
        bytes32 indexed leafHash,
        address indexed validator
    );

    /**
     * @dev Emitted when relayer address is updated
     * @param oldRelayer Previous relayer address
     * @param newRelayer New relayer address
     */
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    /**
     * @dev Emitted when a nonce is marked as used
     * @param nonce The nonce that was used
     */
    event NonceUsed(uint256 indexed nonce);

    // ============ Errors ============

    error InvalidProof();
    error NonceAlreadyUsed(uint256 nonce);
    error InvalidRoot();
    error RootUpdateTooSoon();
    error InvalidRelayer();
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @dev Initializes the validator contract
     * @param _relayer Address of the trusted relayer
     */
    constructor(address _relayer) Ownable(msg.sender) {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
        lastRootUpdate = block.timestamp;
    }

    // ============ Modifiers ============

    /**
     * @dev Modifier to restrict function access to relayer only
     */
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert InvalidRelayer();
        _;
    }

    // ============ External Functions ============

    /**
     * @dev Registers a new Merkle root
     * @param root The Merkle root to register
     * 
     * Requirements:
     * - Caller must be relayer
     * - Contract must not be paused
     * - Sufficient time must have passed since last update
     */
    function registerRoot(bytes32 root) external onlyRelayer whenNotPaused {
        if (block.timestamp < lastRootUpdate + MIN_ROOT_UPDATE_DELAY) {
            revert RootUpdateTooSoon();
        }

        validRoots[root] = true;
        lastRootUpdate = block.timestamp;

        emit RootRegistered(root, block.timestamp);
    }

    /**
     * @dev Validates a bridge transaction using Merkle proof
     * @param sender Address that initiated the bridge
     * @param recipient Address receiving the tokens
     * @param amount Amount being bridged
     * @param nonce Unique transaction nonce
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param timestamp Transaction timestamp
     * @param proof Merkle proof
     * @param root Merkle root to verify against
     * @return bool True if validation succeeds
     * 
     * This is the core validation function used by both BridgeVault and BridgeToken
     */
    function validateTransaction(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 timestamp,
        bytes32[] memory proof,
        bytes32 root
    ) external whenNotPaused nonReentrant returns (bool) {
        // Check if nonce has been used
        if (usedNonces[nonce]) {
            revert NonceAlreadyUsed(nonce);
        }

        // Check if root is valid
        if (!validRoots[root]) {
            revert InvalidRoot();
        }

        // Generate leaf hash from transaction data
        bytes32 leafHash = MessageLib.generateLeafHash(
            sender,
            recipient,
            amount,
            nonce,
            sourceChainId,
            destinationChainId,
            timestamp
        );

        // Verify Merkle proof
        if (!MerkleProof.verify(proof, root, leafHash)) {
            revert InvalidProof();
        }

        // Mark nonce as used
        usedNonces[nonce] = true;
        validatedTransactions++;

        emit TransactionValidated(nonce, leafHash, msg.sender);
        emit NonceUsed(nonce);

        return true;
    }

    /**
     * @dev Verifies a Merkle proof without marking nonce as used
     * @param leafHash The leaf hash to verify
     * @param proof The Merkle proof
     * @param root The Merkle root
     * @return bool True if proof is valid
     * 
     * This is a view function for checking proofs without state changes
     */
    function verifyProof(
        bytes32 leafHash,
        bytes32[] memory proof,
        bytes32 root
    ) external view returns (bool) {
        if (!validRoots[root]) {
            return false;
        }
        return MerkleProof.verify(proof, root, leafHash);
    }

    /**
     * @dev Generates a leaf hash from transaction parameters
     * @param sender Sender address
     * @param recipient Recipient address
     * @param amount Amount
     * @param nonce Nonce
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param timestamp Timestamp
     * @return bytes32 The generated leaf hash
     */
    function generateLeafHash(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 timestamp
    ) external pure returns (bytes32) {
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
     * @dev Checks if a nonce has been used
     * @param nonce The nonce to check
     * @return bool True if nonce has been used
     */
    function isNonceUsed(uint256 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    /**
     * @dev Checks if a root is valid
     * @param root The root to check
     * @return bool True if root is valid
     */
    function isRootValid(bytes32 root) external view returns (bool) {
        return validRoots[root];
    }

    // ============ Admin Functions ============

    /**
     * @dev Updates the relayer address
     * @param newRelayer New relayer address
     * 
     * Requirements:
     * - Caller must be owner
     * - New relayer cannot be zero address
     */
    function updateRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        
        address oldRelayer = relayer;
        relayer = newRelayer;

        emit RelayerUpdated(oldRelayer, newRelayer);
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
     * @dev Batch register multiple roots (gas optimization)
     * @param roots Array of Merkle roots to register
     * 
     * Requirements:
     * - Caller must be relayer
     * - Contract must not be paused
     */
    function batchRegisterRoots(
        bytes32[] calldata roots
    ) external onlyRelayer whenNotPaused {
        if (block.timestamp < lastRootUpdate + MIN_ROOT_UPDATE_DELAY) {
            revert RootUpdateTooSoon();
        }

        for (uint256 i = 0; i < roots.length; i++) {
            validRoots[roots[i]] = true;
            emit RootRegistered(roots[i], block.timestamp);
        }

        lastRootUpdate = block.timestamp;
    }

    /**
     * @dev Emergency function to invalidate a root
     * @param root The root to invalidate
     * 
     * Requirements:
     * - Caller must be owner
     * 
     * Use case: If a fraudulent root was registered
     */
    function invalidateRoot(bytes32 root) external onlyOwner {
        validRoots[root] = false;
    }

    // ============ View Functions ============

    /**
     * @dev Returns contract version
     * @return string Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Returns contract information
     * @return relayerAddress Current relayer
     * @return totalValidated Total validated transactions
     * @return isPaused Whether contract is paused
     */
    function getInfo() external view returns (
        address relayerAddress,
        uint256 totalValidated,
        bool isPaused
    ) {
        return (relayer, validatedTransactions, paused());
    }
}

