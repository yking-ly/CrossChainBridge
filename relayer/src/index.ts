import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import config, { validateConfig } from './config';
import { logger } from './logger';
import { getDb, DatabaseService } from './database';
import { EventListener } from './eventListener';
import { TransactionSubmitter } from './transactionSubmitter';

/**
 * Main entry point for the relayer service
 */
class RelayerService {
    private app: express.Application;
    private server: http.Server;
    private io: Server;
    private eventListener: EventListener;
    private transactionSubmitter: TransactionSubmitter;
    private db!: DatabaseService;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: '*', // In production, restrict this
                methods: ['GET', 'POST'],
            },
        });

        this.eventListener = new EventListener();
        this.transactionSubmitter = new TransactionSubmitter();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * Setup Express middleware
     */
    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());

        // Request logging
        this.app.use((req, _res, next) => {
            logger.info(`${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup API routes
     */
    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        });

        // Get relayer status
        this.app.get('/status', (_req, res) => {
            const stats = this.db.getStats();
            res.json({
                eventListener: this.eventListener.getStatus(),
                database: stats,
                config: {
                    sepolia: {
                        chainId: config.sepolia.chainId,
                        vaultAddress: config.sepolia.bridgeVault,
                    },
                    amoy: {
                        chainId: config.amoy.chainId,
                        tokenAddress: config.amoy.bridgeToken,
                    },
                },
            });
        });

        // Get transaction by hash
        this.app.get('/transaction/:txHash', (req, res) => {
            const { txHash } = req.params;
            const tx = this.db.getTransaction(txHash);

            if (!tx) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            res.json(tx);
        });

        // Get all pending transactions
        this.app.get('/transactions/pending', (_req, res) => {
            const pending = this.db.getPendingTransactions();
            res.json(pending);
        });

        // Get all processing transactions
        this.app.get('/transactions/processing', (_req, res) => {
            const processing = this.db.getProcessingTransactions();
            res.json(processing);
        });

        // Get statistics
        this.app.get('/stats', (_req, res) => {
            const stats = this.db.getStats();
            res.json(stats);
        });

        // 404 handler
        this.app.use((_req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        // Error handler
        this.app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            logger.error('Express error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    /**
     * Setup WebSocket for real-time updates
     */
    private setupWebSocket(): void {
        this.io.on('connection', (socket) => {
            logger.info(`WebSocket client connected: ${socket.id}`);

            // Send current stats on connection
            socket.emit('stats', this.db.getStats());

            socket.on('disconnect', () => {
                logger.info(`WebSocket client disconnected: ${socket.id}`);
            });
        });

        // Emit stats every 10 seconds
        setInterval(() => {
            this.io.emit('stats', this.db.getStats());
        }, 10000);
    }

    /**
     * Starts the relayer service
     */
    async start(): Promise<void> {
        try {
            logger.info('='.repeat(60));
            logger.info('CROSS-CHAIN BRIDGE RELAYER');
            logger.info('='.repeat(60));

            // Validate configuration
            validateConfig();
            logger.info('✅ Configuration validated');

            // Initialize database
            this.db = await getDb();
            logger.info('✅ Database initialized');

            // Start event listener
            await this.eventListener.start();
            logger.info('✅ Event listener started');

            // Start transaction submitter
            await this.transactionSubmitter.start();
            logger.info('✅ Transaction submitter started');

            // Start HTTP server
            await new Promise<void>((resolve) => {
                this.server.listen(config.relayer.port, () => {
                    logger.info(`✅ HTTP server listening on port ${config.relayer.port}`);
                    resolve();
                });
            });

            logger.info('='.repeat(60));
            logger.info('🚀 Relayer service is running!');
            logger.info('='.repeat(60));
            logger.info(`API: http://localhost:${config.relayer.port}`);
            logger.info(`WebSocket: ws://localhost:${config.relayer.port}`);
            logger.info('='.repeat(60));
        } catch (error) {
            logger.error('Failed to start relayer service:', error);
            process.exit(1);
        }
    }

    /**
     * Stops the relayer service
     */
    async stop(): Promise<void> {
        logger.info('Stopping relayer service...');

        this.eventListener.stop();
        this.transactionSubmitter.stop();

        await new Promise<void>((resolve) => {
            this.server.close(() => {
                logger.info('HTTP server stopped');
                resolve();
            });
        });

        this.db.close();
        logger.info('Database closed');

        logger.info('Relayer service stopped');
    }
}

// Create and start the service
const relayer = new RelayerService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('\nReceived SIGINT, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('\nReceived SIGTERM, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the service
relayer.start().catch((error) => {
    logger.error('Failed to start relayer:', error);
    process.exit(1);
});

