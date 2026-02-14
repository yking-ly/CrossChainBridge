import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('MerkleProof Library', function () {
    let merkleProofTest: any;

    beforeEach(async function () {
        // Deploy a test contract that uses MerkleProof library
        const MerkleProofTest = await ethers.getContractFactory('MerkleProofTest');
        merkleProofTest = await MerkleProofTest.deploy();
        await merkleProofTest.waitForDeployment();
    });

    describe('Single Proof Verification', function () {
        it('Should verify valid single-leaf proof', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const root = leaf; // Single leaf tree
            const proof: string[] = [];

            const isValid = await merkleProofTest.verify(proof, root, leaf);
            expect(isValid).to.be.true;
        });

        it('Should verify valid two-leaf proof', async function () {
            const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('leaf1'));
            const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('leaf2'));

            // Calculate root manually (sorted pair)
            const root =
                leaf1 < leaf2
                    ? ethers.keccak256(ethers.concat([leaf1, leaf2]))
                    : ethers.keccak256(ethers.concat([leaf2, leaf1]));

            // Proof for leaf1 is [leaf2]
            const proof = [leaf2];

            const isValid = await merkleProofTest.verify(proof, root, leaf1);
            expect(isValid).to.be.true;
        });

        it('Should verify valid four-leaf proof', async function () {
            const leaves = [
                ethers.keccak256(ethers.toUtf8Bytes('leaf0')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf1')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf2')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf3')),
            ].sort();

            // Build tree manually
            const layer1 = [
                ethers.keccak256(ethers.concat([leaves[0], leaves[1]])),
                ethers.keccak256(ethers.concat([leaves[2], leaves[3]])),
            ];

            const root = ethers.keccak256(ethers.concat([layer1[0], layer1[1]]));

            // Proof for leaves[0]: [leaves[1], layer1[1]]
            const proof = [leaves[1], layer1[1]];

            const isValid = await merkleProofTest.verify(proof, root, leaves[0]);
            expect(isValid).to.be.true;
        });

        it('Should reject invalid proof', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const wrongRoot = ethers.keccak256(ethers.toUtf8Bytes('wrong'));
            const proof: string[] = [];

            const isValid = await merkleProofTest.verify(proof, wrongRoot, leaf);
            expect(isValid).to.be.false;
        });

        it('Should reject proof with wrong sibling', async function () {
            const leaf1 = ethers.keccak256(ethers.toUtf8Bytes('leaf1'));
            const leaf2 = ethers.keccak256(ethers.toUtf8Bytes('leaf2'));
            const wrongLeaf = ethers.keccak256(ethers.toUtf8Bytes('wrong'));

            const root =
                leaf1 < leaf2
                    ? ethers.keccak256(ethers.concat([leaf1, leaf2]))
                    : ethers.keccak256(ethers.concat([leaf2, leaf1]));

            // Wrong proof
            const proof = [wrongLeaf];

            const isValid = await merkleProofTest.verify(proof, root, leaf1);
            expect(isValid).to.be.false;
        });
    });

    describe('Multi Proof Verification', function () {
        it('Should verify valid multi-proof for two leaves', async function () {
            const leaves = [
                ethers.keccak256(ethers.toUtf8Bytes('leaf0')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf1')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf2')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf3')),
            ].sort();

            // Build tree
            const layer1 = [
                ethers.keccak256(ethers.concat([leaves[0], leaves[1]])),
                ethers.keccak256(ethers.concat([leaves[2], leaves[3]])),
            ];

            const root = ethers.keccak256(ethers.concat([layer1[0], layer1[1]]));

            // Verify leaves[0] and leaves[1] together
            const proofLeaves = [leaves[0], leaves[1]];
            const proof = [layer1[1]]; // Only need the other branch
            const proofFlags = [false, false, true]; // Indicates which nodes to use

            const isValid = await merkleProofTest.verifyMultiProof(
                proof,
                proofFlags,
                root,
                proofLeaves
            );
            expect(isValid).to.be.true;
        });

        it('Should reject invalid multi-proof', async function () {
            const leaves = [
                ethers.keccak256(ethers.toUtf8Bytes('leaf0')),
                ethers.keccak256(ethers.toUtf8Bytes('leaf1')),
            ];

            const root = ethers.keccak256(ethers.toUtf8Bytes('wrong-root'));
            const proof: string[] = [];
            const proofFlags = [false, false];

            const isValid = await merkleProofTest.verifyMultiProof(
                proof,
                proofFlags,
                root,
                leaves
            );
            expect(isValid).to.be.false;
        });
    });

    describe('Process Proof', function () {
        it('Should process proof correctly', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const sibling = ethers.keccak256(ethers.toUtf8Bytes('sibling'));

            const expectedRoot =
                leaf < sibling
                    ? ethers.keccak256(ethers.concat([leaf, sibling]))
                    : ethers.keccak256(ethers.concat([sibling, leaf]));

            const proof = [sibling];
            const computedRoot = await merkleProofTest.processProof(proof, leaf);

            expect(computedRoot).to.equal(expectedRoot);
        });

        it('Should process empty proof', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const proof: string[] = [];

            const computedRoot = await merkleProofTest.processProof(proof, leaf);
            expect(computedRoot).to.equal(leaf);
        });

        it('Should process multi-level proof', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf0'));
            const sibling1 = ethers.keccak256(ethers.toUtf8Bytes('leaf1'));
            const sibling2 = ethers.keccak256(ethers.toUtf8Bytes('branch'));

            // First level
            const level1 =
                leaf < sibling1
                    ? ethers.keccak256(ethers.concat([leaf, sibling1]))
                    : ethers.keccak256(ethers.concat([sibling1, leaf]));

            // Second level
            const expectedRoot =
                level1 < sibling2
                    ? ethers.keccak256(ethers.concat([level1, sibling2]))
                    : ethers.keccak256(ethers.concat([sibling2, level1]));

            const proof = [sibling1, sibling2];
            const computedRoot = await merkleProofTest.processProof(proof, leaf);

            expect(computedRoot).to.equal(expectedRoot);
        });
    });

    describe('Edge Cases', function () {
        it('Should handle identical leaves', async function () {
            const leaf = ethers.keccak256(ethers.toUtf8Bytes('same'));
            const root = ethers.keccak256(ethers.concat([leaf, leaf]));
            const proof = [leaf];

            const isValid = await merkleProofTest.verify(proof, root, leaf);
            expect(isValid).to.be.true;
        });

        it('Should handle very long proof', async function () {
            // Create a deep tree (8 levels, 256 leaves)
            let currentHash = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const proof: string[] = [];

            // Generate proof path
            for (let i = 0; i < 8; i++) {
                const sibling = ethers.keccak256(
                    ethers.toUtf8Bytes(`sibling-${i}`)
                );
                proof.push(sibling);

                currentHash =
                    currentHash < sibling
                        ? ethers.keccak256(ethers.concat([currentHash, sibling]))
                        : ethers.keccak256(ethers.concat([sibling, currentHash]));
            }

            const leaf = ethers.keccak256(ethers.toUtf8Bytes('leaf'));
            const computedRoot = await merkleProofTest.processProof(proof, leaf);

            expect(computedRoot).to.equal(currentHash);
        });
    });
});

// Note: You'll need to create a test contract that exposes the MerkleProof library functions
// Create contracts/test/MerkleProofTest.sol with the following content:
/*
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/MerkleProof.sol";

contract MerkleProofTest {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

    function verifyMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) public pure returns (bool) {
        return MerkleProof.verifyMultiProof(proof, proofFlags, root, leaves);
    }

    function processProof(
        bytes32[] memory proof,
        bytes32 leaf
    ) public pure returns (bytes32) {
        return MerkleProof.processProof(proof, leaf);
    }
}
*/

