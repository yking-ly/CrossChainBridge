// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MessageLib
 * @dev Library for encoding and decoding cross-chain bridge messages
 * @notice Provides standardized message format for cross-chain communication
 * 
 * Message Structure:
 * - sender: Address initiating the bridge
 * - recipient: Address receiving on destination chain
 * - amount: Amount of tokens to bridge
 * - nonce: Unique identifier preventing replay attacks
 * - sourceChainId: Chain ID where bridge was initiated
 * - destinationChainId: Target chain ID
 * - timestamp: When the bridge was initiated
 */
library MessageLib {
    /**
     * @dev Structure representing a cross-chain bridge message
     */
    struct BridgeMessage {
        address sender;           // Who initiated the bridge
        address recipient;        // Who receives on destination
        uint256 amount;          // Amount to bridge
        uint256 nonce;           // Unique transaction ID
        uint256 sourceChainId;   // Origin chain
        uint256 destinationChainId; // Target chain
        uint256 timestamp;       // When initiated
    }

    /**
     * @dev Encodes a bridge message into a bytes32 hash
     * @param message The bridge message to encode
     * @return bytes32 The encoded message hash
     * 
     * This creates a unique identifier for each bridge transaction
     * Used as a leaf in the Merkle tree
     */
    function encode(
        BridgeMessage memory message
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                message.sender,
                message.recipient,
                message.amount,
                message.nonce,
                message.sourceChainId,
                message.destinationChainId,
                message.timestamp
            )
        );
    }

    /**
     * @dev Generates a leaf hash for Merkle tree from individual parameters
     * @param sender Address initiating the bridge
     * @param recipient Address receiving tokens
     * @param amount Amount to bridge
     * @param nonce Unique transaction nonce
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param timestamp Transaction timestamp
     * @return bytes32 The leaf hash
     */
    function generateLeafHash(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                sender,
                recipient,
                amount,
                nonce,
                sourceChainId,
                destinationChainId,
                timestamp
            )
        );
    }

    /**
     * @dev Validates a bridge message
     * @param message The message to validate
     * @return bool True if valid, reverts otherwise
     */
    function validate(
        BridgeMessage memory message
    ) internal pure returns (bool) {
        require(message.sender != address(0), "MessageLib: invalid sender");
        require(message.recipient != address(0), "MessageLib: invalid recipient");
        require(message.amount > 0, "MessageLib: amount must be > 0");
        require(message.sourceChainId != message.destinationChainId, 
            "MessageLib: same chain bridge not allowed");
        require(message.timestamp > 0, "MessageLib: invalid timestamp");
        
        return true;
    }

    /**
     * @dev Encodes message for cross-chain transmission
     * @param message The bridge message
     * @return bytes The encoded message
     */
    function encodeMessage(
        BridgeMessage memory message
    ) internal pure returns (bytes memory) {
        return abi.encode(
            message.sender,
            message.recipient,
            message.amount,
            message.nonce,
            message.sourceChainId,
            message.destinationChainId,
            message.timestamp
        );
    }

    /**
     * @dev Decodes a message from bytes
     * @param data The encoded message data
     * @return BridgeMessage The decoded message
     */
    function decodeMessage(
        bytes memory data
    ) internal pure returns (BridgeMessage memory) {
        (
            address sender,
            address recipient,
            uint256 amount,
            uint256 nonce,
            uint256 sourceChainId,
            uint256 destinationChainId,
            uint256 timestamp
        ) = abi.decode(
            data,
            (address, address, uint256, uint256, uint256, uint256, uint256)
        );

        return BridgeMessage({
            sender: sender,
            recipient: recipient,
            amount: amount,
            nonce: nonce,
            sourceChainId: sourceChainId,
            destinationChainId: destinationChainId,
            timestamp: timestamp
        });
    }

    /**
     * @dev Generates a unique message ID
     * @param message The bridge message
     * @return bytes32 Unique message identifier
     */
    function getMessageId(
        BridgeMessage memory message
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            message.sender,
            message.nonce,
            message.sourceChainId
        ));
    }

    /**
     * @dev Checks if two messages are equal
     * @param a First message
     * @param b Second message
     * @return bool True if messages are identical
     */
    function equals(
        BridgeMessage memory a,
        BridgeMessage memory b
    ) internal pure returns (bool) {
        return encode(a) == encode(b);
    }
}

