import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers';
import { logger } from './logger';

export interface Transaction {
    sender: string;
    recipient: string;
    amount: string;
    nonce: number;
    sourceChainId: number;
    destinationChainId: number;
    timestamp: number;
}

export class ProofGenerator {
    /**
     * Generates a leaf hash from transaction data
     */
    static generateLeafHash(tx: Transaction): string {
        const encoded = Buffer.concat([
            Buffer.from(tx.sender.slice(2), 'hex'),
            Buffer.from(tx.recipient.slice(2), 'hex'),
            Buffer.from(BigInt(tx.amount).toString(16).padStart(64, '0'), 'hex'),
            Buffer.from(tx.nonce.toString(16).padStart(64, '0'), 'hex'),
            Buffer.from(tx.sourceChainId.toString(16).padStart(64, '0'), 'hex'),
            Buffer.from(tx.destinationChainId.toString(16).padStart(64, '0'), 'hex'),
            Buffer.from(tx.timestamp.toString(16).padStart(64, '0'), 'hex'),
        ]);

        return keccak256(encoded);
    }

    /**
     * Builds a Merkle tree from transactions
     */
    static buildMerkleTree(transactions: Transaction[]): MerkleTree {
        const leaves = transactions.map(tx => this.generateLeafHash(tx));

        // Use keccak256 for hashing, sort pairs for deterministic tree
        const tree = new MerkleTree(leaves, keccak256, {
            sortPairs: true,
            hashLeaves: false, // Already hashed
        });

        logger.info(`Built Merkle tree with ${transactions.length} transactions`);
        logger.info(`Merkle root: ${tree.getHexRoot()}`);

        return tree;
    }

    /**
     * Generates a Merkle proof for a specific transaction
     */
    static generateProof(
        transactions: Transaction[],
        targetTx: Transaction
    ): { proof: string[]; root: string } {
        const tree = this.buildMerkleTree(transactions);
        const leafHash = this.generateLeafHash(targetTx);
        const proof = tree.getHexProof(leafHash);
        const root = tree.getHexRoot();

        logger.info(`Generated proof for transaction nonce ${targetTx.nonce}`);
        logger.info(`Proof length: ${proof.length}`);
        logger.info(`Root: ${root}`);

        return { proof, root };
    }

    /**
     * Verifies a Merkle proof
     */
    static verifyProof(
        leafHash: string,
        proof: string[],
        root: string
    ): boolean {
        const tree = new MerkleTree([], keccak256, { sortPairs: true });
        const verified = tree.verify(proof, leafHash, root);

        logger.info(`Proof verification: ${verified ? 'VALID' : 'INVALID'}`);

        return verified;
    }

    /**
     * Generates proofs for multiple transactions (batch)
     */
    static generateBatchProofs(
        transactions: Transaction[]
    ): Map<number, { proof: string[]; root: string }> {
        const tree = this.buildMerkleTree(transactions);
        const root = tree.getHexRoot();
        const proofs = new Map<number, { proof: string[]; root: string }>();

        for (const tx of transactions) {
            const leafHash = this.generateLeafHash(tx);
            const proof = tree.getHexProof(leafHash);
            proofs.set(tx.nonce, { proof, root });
        }

        logger.info(`Generated ${proofs.size} proofs in batch`);

        return proofs;
    }

    /**
     * Gets the Merkle root for a set of transactions
     */
    static getMerkleRoot(transactions: Transaction[]): string {
        const tree = this.buildMerkleTree(transactions);
        return tree.getHexRoot();
    }

    /**
     * Validates transaction data before generating proof
     */
    static validateTransaction(tx: Transaction): boolean {
        if (!tx.sender || !tx.recipient) {
            logger.error('Invalid transaction: missing sender or recipient');
            return false;
        }

        if (BigInt(tx.amount) <= 0) {
            logger.error('Invalid transaction: amount must be > 0');
            return false;
        }

        if (tx.nonce < 0) {
            logger.error('Invalid transaction: nonce must be >= 0');
            return false;
        }

        if (tx.sourceChainId === tx.destinationChainId) {
            logger.error('Invalid transaction: source and destination chains are the same');
            return false;
        }

        return true;
    }
}

