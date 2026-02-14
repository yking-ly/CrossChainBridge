import { ethers } from 'ethers';
import config from './config';
import { logger } from './logger';
import { getDb, DatabaseService, BridgeTransaction } from './database';
import { ProofGenerator, Transaction } from './proofGenerator';

// ABIs
const BRIDGE_VALIDATOR_ABI = [
    'function registerRoot(bytes32 root) external',
    'function validRoots(bytes32) view returns (bool)',
];

const BRIDGE_TOKEN_ABI = [
    'function mint(address sender, address recipient, uint256 amount, uint256 nonce, uint256 timestamp, bytes32 sourceChainTxHash, bytes32[] proof, bytes32 root) external',
];

const BRIDGE_VAULT_ABI = [
    'function unlock(address sender, address recipient, uint256 amount, uint256 nonce, uint256 timestamp, bytes32[] proof, bytes32 root) external',
];

export class TransactionSubmitter {
    private sepoliaProvider: ethers.JsonRpcProvider;
    private amoyProvider: ethers.JsonRpcProvider;
    private relayerWallet: ethers.Wallet;
    private sepoliaRelayer: ethers.Wallet;
    private amoyRelayer: ethers.Wallet;
    private isRunning: boolean = false;
    private db!: DatabaseService;

    constructor() {
        // Initialize providers
        this.sepoliaProvider = new ethers.JsonRpcProvider(config.sepolia.rpcUrl);
        this.amoyProvider = new ethers.JsonRpcProvider(config.amoy.rpcUrl);

        // Initialize relayer wallet
        this.relayerWallet = new ethers.Wallet(config.relayer.privateKey);
        this.sepoliaRelayer = this.relayerWallet.connect(this.sepoliaProvider);
        this.amoyRelayer = this.relayerWallet.connect(this.amoyProvider);
    }

    /**
     * Starts the transaction submitter
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Transaction submitter is already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting transaction submitter...');

        // Initialize database
        this.db = await getDb();

        // Check relayer balance
        await this.checkBalances();

        // Start processing loop
        this.processLoop();

        logger.info('Transaction submitter started successfully');
    }

    /**
     * Main processing loop
     */
    private async processLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                // Process pending transactions
                await this.processPendingTransactions();

                // Wait before next iteration
                await this.sleep(config.processing.pollingInterval);
            } catch (error) {
                logger.error('Error in processing loop:', error);
                await this.sleep(5000); // Wait 5 seconds before retrying
            }
        }
    }

    /**
     * Processes pending transactions
     */
    private async processPendingTransactions(): Promise<void> {
        const pendingTxs = this.db.getPendingTransactions();

        if (pendingTxs.length === 0) {
            return;
        }

        logger.info(`Processing ${pendingTxs.length} pending transactions...`);

        for (const tx of pendingTxs) {
            try {
                await this.processTransaction(tx);
            } catch (error) {
                logger.error(`Error processing transaction ${tx.txHash}:`, error);

                // Update status to failed
                this.db.updateTransactionStatus(tx.txHash, 'failed', {
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    }

    /**
     * Processes a single transaction
     */
    private async processTransaction(tx: BridgeTransaction): Promise<void> {
        logger.info(`Processing transaction ${tx.txHash}...`);

        // Update status to processing
        this.db.updateTransactionStatus(tx.txHash, 'processing');

        // Generate proof
        const { proof, root } = await this.generateProofForTransaction(tx);

        // Update transaction with proof
        this.db.updateTransactionStatus(tx.txHash, 'processing', {
            proof: JSON.stringify(proof),
            merkleRoot: root,
        });

        // Register root on destination chain if needed
        await this.ensureRootRegistered(root, tx.destChain);

        // Submit transaction to destination chain
        const destTxHash = await this.submitToDestinationChain(tx, proof, root);

        // Update status to completed
        this.db.updateTransactionStatus(tx.txHash, 'completed', {
            destTxHash,
        });

        logger.info(`✅ Transaction ${tx.txHash} processed successfully`);
        logger.info(`   Destination tx: ${destTxHash}`);
    }

    /**
     * Generates proof for a transaction
     */
    private async generateProofForTransaction(
        tx: BridgeTransaction
    ): Promise<{ proof: string[]; root: string }> {
        logger.info(`Generating proof for transaction ${tx.txHash}...`);

        // For simplicity, we'll create a Merkle tree with just this transaction
        // In production, you'd batch multiple transactions
        const transaction: Transaction = {
            sender: tx.sender,
            recipient: tx.recipient,
            amount: tx.amount,
            nonce: tx.nonce,
            sourceChainId: tx.sourceChain === 'sepolia' ? config.sepolia.chainId : config.amoy.chainId,
            destinationChainId: tx.destChain === 'amoy' ? config.amoy.chainId : config.sepolia.chainId,
            timestamp: tx.timestamp,
        };

        const { proof, root } = ProofGenerator.generateProof([transaction], transaction);

        logger.info(`Proof generated with root: ${root}`);

        return { proof, root };
    }

    /**
     * Ensures Merkle root is registered on destination chain
     */
    private async ensureRootRegistered(root: string, destChain: string): Promise<void> {
        logger.info(`Checking if root ${root} is registered on ${destChain}...`);

        const validator = destChain === 'amoy'
            ? new ethers.Contract(config.amoy.bridgeValidator, BRIDGE_VALIDATOR_ABI, this.amoyRelayer)
            : new ethers.Contract(config.sepolia.bridgeValidator, BRIDGE_VALIDATOR_ABI, this.sepoliaRelayer);

        const isRegistered = await validator.validRoots(root);

        if (isRegistered) {
            logger.info(`Root ${root} is already registered on ${destChain}`);
            return;
        }

        logger.info(`Registering root ${root} on ${destChain}...`);

        const tx = await validator.registerRoot(root);
        const receipt = await tx.wait();

        logger.info(`✅ Root registered on ${destChain}, tx: ${receipt.hash}`);
    }

    /**
     * Submits transaction to destination chain
     */
    private async submitToDestinationChain(
        tx: BridgeTransaction,
        proof: string[],
        root: string
    ): Promise<string> {
        if (tx.destChain === 'amoy') {
            return await this.submitMintTransaction(tx, proof, root);
        } else {
            return await this.submitUnlockTransaction(tx, proof, root);
        }
    }

    /**
     * Submits mint transaction to amoy
     */
    private async submitMintTransaction(
        tx: BridgeTransaction,
        proof: string[],
        root: string
    ): Promise<string> {
        logger.info(`Submitting mint transaction to amoy...`);

        const tokenContract = new ethers.Contract(
            config.amoy.bridgeToken,
            BRIDGE_TOKEN_ABI,
            this.amoyRelayer
        );

        const mintTx = await tokenContract.mint(
            tx.sender,
            tx.recipient,
            tx.amount,
            tx.nonce,
            tx.timestamp,
            tx.txHash, // sourceChainTxHash
            proof,
            root,
            {
                gasLimit: 500000, // Set reasonable gas limit
            }
        );

        const receipt = await mintTx.wait();

        logger.info(`✅ Mint transaction submitted: ${receipt.hash}`);

        return receipt.hash;
    }

    /**
     * Submits unlock transaction to Sepolia
     */
    private async submitUnlockTransaction(
        tx: BridgeTransaction,
        proof: string[],
        root: string
    ): Promise<string> {
        logger.info(`Submitting unlock transaction to Sepolia...`);

        const vaultContract = new ethers.Contract(
            config.sepolia.bridgeVault,
            BRIDGE_VAULT_ABI,
            this.sepoliaRelayer
        );

        const unlockTx = await vaultContract.unlock(
            tx.sender,
            tx.recipient,
            tx.amount,
            tx.nonce,
            tx.timestamp,
            proof,
            root,
            {
                gasLimit: 500000,
            }
        );

        const receipt = await unlockTx.wait();

        logger.info(`✅ Unlock transaction submitted: ${receipt.hash}`);

        return receipt.hash;
    }

    /**
     * Checks relayer balances on both chains
     */
    private async checkBalances(): Promise<void> {
        const sepoliaBalance = await this.sepoliaProvider.getBalance(this.relayerWallet.address);
        const amoyBalance = await this.amoyProvider.getBalance(this.relayerWallet.address);

        logger.info(`Relayer address: ${this.relayerWallet.address}`);
        logger.info(`Sepolia balance: ${ethers.formatEther(sepoliaBalance)} ETH`);
        logger.info(`amoy balance: ${ethers.formatEther(amoyBalance)} MATIC`);

        if (sepoliaBalance < ethers.parseEther('0.01')) {
            logger.warn('⚠️  Low Sepolia balance! Get more from faucet.');
        }

        if (amoyBalance < ethers.parseEther('0.1')) {
            logger.warn('⚠️  Low amoy balance! Get more from faucet.');
        }
    }

    /**
     * Stops the transaction submitter
     */
    stop(): void {
        if (!this.isRunning) {
            logger.warn('Transaction submitter is not running');
            return;
        }

        logger.info('Stopping transaction submitter...');
        this.isRunning = false;
        logger.info('Transaction submitter stopped');
    }

    /**
     * Helper: sleep function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

