// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MerkleProof
 * @dev Library for verifying Merkle proofs
 * @notice This library provides cryptographic verification for cross-chain messages
 * 
 * Merkle trees allow us to prove that a specific transaction is part of a set
 * without revealing all transactions. This is crucial for cross-chain bridges.
 * 
 * How it works:
 * 1. Build a Merkle tree from all bridge transactions
 * 2. Store only the root hash on-chain (saves gas)
 * 3. Generate a proof (path from leaf to root)
 * 4. Verify the proof matches the stored root
 */
library MerkleProof {
    /**
     * @dev Verifies a Merkle proof proving the existence of a leaf in a Merkle tree
     * @param proof Array of sibling hashes from leaf to root
     * @param root The Merkle root hash
     * @param leaf The leaf hash to verify
     * @return bool True if the proof is valid, false otherwise
     * 
     * Example:
     *        root
     *       /    \
     *      h1     h2
     *     / \    / \
     *    a   b  c   d
     * 
     * To prove 'a' exists, provide proof = [b, h2]
     * Verification: hash(hash(a, b), h2) == root
     */
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    /**
     * @dev Processes a Merkle proof to compute the root hash
     * @param proof Array of sibling hashes
     * @param leaf The starting leaf hash
     * @return bytes32 The computed root hash
     */
    function processProof(
        bytes32[] memory proof,
        bytes32 leaf
    ) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = _hashPair(computedHash, proof[i]);
        }
        
        return computedHash;
    }

    /**
     * @dev Hashes two bytes32 values in a deterministic order
     * @param a First hash
     * @param b Second hash
     * @return bytes32 The combined hash
     * 
     * Note: We sort the hashes to ensure deterministic ordering
     * This prevents issues with left/right positioning in the tree
     */
    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? _efficientHash(a, b) : _efficientHash(b, a);
    }

    /**
     * @dev Efficient keccak256 hash of two bytes32 values
     * @param a First value
     * @param b Second value
     * @return value The hash result
     */
    function _efficientHash(
        bytes32 a,
        bytes32 b
    ) private pure returns (bytes32 value) {
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }

    /**
     * @dev Verifies a multi-proof (more efficient for multiple leaves)
     * @param proof Array of proof hashes
     * @param proofFlags Boolean flags indicating which proof elements to use
     * @param root The Merkle root
     * @param leaves Array of leaves to verify
     * @return bool True if all leaves are verified
     * 
     * This is more gas-efficient when verifying multiple leaves at once
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProof(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Processes a multi-proof to compute the root
     * @param proof Array of proof hashes
     * @param proofFlags Boolean flags for proof navigation
     * @param leaves Array of leaf hashes
     * @return bytes32 The computed root hash
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32) {
        uint256 leavesLen = leaves.length;
        uint256 totalHashes = proofFlags.length;

        require(
            leavesLen + proof.length - 1 == totalHashes,
            "MerkleProof: invalid multiproof"
        );

        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;

        for (uint256 i = 0; i < totalHashes; i++) {
            bytes32 a = leafPos < leavesLen
                ? leaves[leafPos++]
                : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = _hashPair(a, b);
        }

        return hashes[totalHashes - 1];
    }
}

