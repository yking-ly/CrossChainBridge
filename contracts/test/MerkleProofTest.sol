// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/MerkleProof.sol";

/**
 * @title MerkleProofTest
 * @dev Test contract that exposes MerkleProof library functions for testing
 */
contract MerkleProofTest {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) public pure returns (bool) {
        return MerkleProof.multiProofVerify(proof, proofFlags, root, leaves);
    }

    function processProof(
        bytes32[] memory proof,
        bytes32 leaf
    ) public pure returns (bytes32) {
        return MerkleProof.processProof(proof, leaf);
    }

    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) public pure returns (bytes32) {
        return MerkleProof.processMultiProof(proof, proofFlags, leaves);
    }
}

