import { ethers } from 'ethers';
import config from './config';
import { logger } from './logger';
import { getDb, DatabaseService } from './database';

// ABIs (minimal - only events and functions we need)
const BRIDGE_VAULT_ABI = [
    'event BridgingInitiated(address indexed sender, address indexed recipient, uint256 amount, uint256 indexed nonce, uint256 timestamp, bytes32 leafHash)',
    'function currentNonce() view returns (uint256)',
];

const BRIDGE_TOKEN_ABI = [
    'event TokensBurned(address indexed burner, address indexed recipient, uint256 amount, uint256 indexed nonce, uint256 timestamp, bytes32 leafHash)',
    'function currentNonce() view returns (uint256)',
];

export class EventListener {
    private sepoliaProvider: ethers.JsonRpcProvider;
    private amoyProvider: ethers.JsonRpcProvider;
    private vaultContract: ethers.Contract;
    private tokenContract: ethers.Contract;
    private isRunning: boolean = false;
    private db!: DatabaseService;

    constructor() {
        // Initialize providers
        this.sepoliaProvider = new ethers.JsonRpcProvider(config.sepolia.rpcUrl);
        this.amoyProvider = new ethers.JsonRpcProvider(config.amoy.rpcUrl);

        // Initialize contracts
        this.vaultContract = new ethers.Contract(
            config.sepolia.bridgeVault,
            BRIDGE_VAULT_ABI,
            this.sepoliaProvider
        );

        this.tokenContract = new ethers.Contract(
            config.amoy.bridgeToken,
            BRIDGE_TOKEN_ABI,
            this.amoyProvider
        );
    }

    /**
     * Starts listening for events on both chains
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Event listener is already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting event listener...');

        try {
            // Initialize database
            this.db = await getDb();

            // Get current block numbers
            const sepoliaBlock = await this.sepoliaProvider.getBlockNumber();
            const amoyBlock = await this.amoyProvider.getBlockNumber();

            logger.info(`Connected to Sepolia at block ${sepoliaBlock}`);
            logger.info(`Connected to amoy at block ${amoyBlock}`);

            // Start listening for new events
            this.listenToSepoliaEvents();
            this.listenToamoyEvents();

            // Also process historical events (last 1000 blocks)
            await this.processHistoricalEvents();

            logger.info('Event listener started successfully');
        } catch (error) {
            logger.error('Failed to start event listener:', error);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Listens for BridgingInitiated events on Sepolia
     */
    private listenToSepoliaEvents(): void {
        logger.info('Listening for BridgingInitiated events on Sepolia...');

        this.vaultContract.on(
            'BridgingInitiated',
            async (sender, recipient, amount, nonce, timestamp, leafHash, event) => {
                try {
                    logger.info(`🔔 New BridgingInitiated event detected on Sepolia`);
                    logger.info(`  Sender: ${sender}`);
                    logger.info(`  Recipient: ${recipient}`);
                    logger.info(`  Amount: ${ethers.formatEther(amount)} ETH`);
                    logger.info(`  Nonce: ${nonce}`);
                    logger.info(`  Tx Hash: ${event.log.transactionHash}`);

                    // Wait for confirmations
                    await this.waitForConfirmations(
                        event.log.transactionHash,
                        this.sepoliaProvider,
                        config.processing.confirmations.sepolia
                    );

                    // Store in database
                    const existingTx = this.db.getTransaction(event.log.transactionHash);
                    if (existingTx) {
                        logger.warn(`Transaction ${event.log.transactionHash} already exists in database`);
                        return;
                    }

                    this.db.insertTransaction({
                        txHash: event.log.transactionHash,
                        sourceChain: 'sepolia',
                        destChain: 'amoy',
                        sender: sender,
                        recipient: recipient,
                        amount: amount.toString(),
                        nonce: Number(nonce),
                        timestamp: Number(timestamp),
                        leafHash: leafHash,
                        proof: null,
                        merkleRoot: null,
                        status: 'pending',
                        destTxHash: null,
                        errorMessage: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });

                    logger.info(`✅ Transaction stored in database`);
                } catch (error) {
                    logger.error('Error processing BridgingInitiated event:', error);
                }
            }
        );
    }

    /**
     * Listens for TokensBurned events on amoy
     */
    private listenToamoyEvents(): void {
        logger.info('Listening for TokensBurned events on amoy...');

        this.tokenContract.on(
            'TokensBurned',
            async (burner, recipient, amount, nonce, timestamp, leafHash, event) => {
                try {
                    logger.info(`🔔 New TokensBurned event detected on amoy`);
                    logger.info(`  Burner: ${burner}`);
                    logger.info(`  Recipient: ${recipient}`);
                    logger.info(`  Amount: ${ethers.formatEther(amount)} wSepETH`);
                    logger.info(`  Nonce: ${nonce}`);
                    logger.info(`  Tx Hash: ${event.log.transactionHash}`);

                    // Wait for confirmations
                    await this.waitForConfirmations(
                        event.log.transactionHash,
                        this.amoyProvider,
                        config.processing.confirmations.amoy
                    );

                    // Store in database
                    const existingTx = this.db.getTransaction(event.log.transactionHash);
                    if (existingTx) {
                        logger.warn(`Transaction ${event.log.transactionHash} already exists in database`);
                        return;
                    }

                    this.db.insertTransaction({
                        txHash: event.log.transactionHash,
                        sourceChain: 'amoy',
                        destChain: 'sepolia',
                        sender: burner,
                        recipient: recipient,
                        amount: amount.toString(),
                        nonce: Number(nonce),
                        timestamp: Number(timestamp),
                        leafHash: leafHash,
                        proof: null,
                        merkleRoot: null,
                        status: 'pending',
                        destTxHash: null,
                        errorMessage: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });

                    logger.info(`✅ Transaction stored in database`);
                } catch (error) {
                    logger.error('Error processing TokensBurned event:', error);
                }
            }
        );
    }

    /**
     * Processes historical events (in case relayer was offline)
     */
    private async processHistoricalEvents(): Promise<void> {
        logger.info('Processing historical events...');

        try {
            const currentSepoliaBlock = await this.sepoliaProvider.getBlockNumber();
            const currentamoyBlock = await this.amoyProvider.getBlockNumber();

            const fromSepoliaBlock = Math.max(0, currentSepoliaBlock - 10);
            const fromamoyBlock = Math.max(0, currentamoyBlock - 10);

            // Query Sepolia events
            const sepoliaEvents = await this.vaultContract.queryFilter(
                'BridgingInitiated',
                fromSepoliaBlock,
                currentSepoliaBlock
            );

            logger.info(`Found ${sepoliaEvents.length} historical BridgingInitiated events on Sepolia`);

            for (const event of sepoliaEvents) {
                if (!('args' in event)) continue;
                const args = event.args;
                if (!args) continue;

                const existingTx = this.db.getTransaction(event.transactionHash);
                if (!existingTx) {
                    this.db.insertTransaction({
                        txHash: event.transactionHash,
                        sourceChain: 'sepolia',
                        destChain: 'amoy',
                        sender: args.sender,
                        recipient: args.recipient,
                        amount: args.amount.toString(),
                        nonce: Number(args.nonce),
                        timestamp: Number(args.timestamp),
                        leafHash: args.leafHash,
                        proof: null,
                        merkleRoot: null,
                        status: 'pending',
                        destTxHash: null,
                        errorMessage: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                }
            }

            // Query amoy events
            const amoyEvents = await this.tokenContract.queryFilter(
                'TokensBurned',
                fromamoyBlock,
                currentamoyBlock
            );

            logger.info(`Found ${amoyEvents.length} historical TokensBurned events on amoy`);

            for (const event of amoyEvents) {
                if (!('args' in event)) continue;
                const args = event.args;
                if (!args) continue;

                const existingTx = this.db.getTransaction(event.transactionHash);
                if (!existingTx) {
                    this.db.insertTransaction({
                        txHash: event.transactionHash,
                        sourceChain: 'amoy',
                        destChain: 'sepolia',
                        sender: args.burner,
                        recipient: args.recipient,
                        amount: args.amount.toString(),
                        nonce: Number(args.nonce),
                        timestamp: Number(args.timestamp),
                        leafHash: args.leafHash,
                        proof: null,
                        merkleRoot: null,
                        status: 'pending',
                        destTxHash: null,
                        errorMessage: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                }
            }

            logger.info('Historical events processed');
        } catch (error) {
            logger.error('Error processing historical events:', error);
        }
    }

    /**
     * Waits for transaction confirmations
     */
    private async waitForConfirmations(
        txHash: string,
        provider: ethers.JsonRpcProvider,
        confirmations: number
    ): Promise<void> {
        logger.info(`Waiting for ${confirmations} confirmations for ${txHash}...`);

        const receipt = await provider.waitForTransaction(txHash, confirmations);

        if (!receipt) {
            throw new Error(`Transaction ${txHash} not found`);
        }

        if (receipt.status === 0) {
            throw new Error(`Transaction ${txHash} failed`);
        }

        logger.info(`✅ Transaction ${txHash} confirmed with ${confirmations} confirmations`);
    }

    /**
     * Stops listening for events
     */
    stop(): void {
        if (!this.isRunning) {
            logger.warn('Event listener is not running');
            return;
        }

        logger.info('Stopping event listener...');

        this.vaultContract.removeAllListeners();
        this.tokenContract.removeAllListeners();

        this.isRunning = false;
        logger.info('Event listener stopped');
    }

    /**
     * Gets the current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            sepoliaRpc: config.sepolia.rpcUrl,
            amoyRpc: config.amoy.rpcUrl,
            vaultAddress: config.sepolia.bridgeVault,
            tokenAddress: config.amoy.bridgeToken,
        };
    }
}

