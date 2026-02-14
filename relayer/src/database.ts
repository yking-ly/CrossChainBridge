import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import config from './config';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export interface BridgeTransaction {
    id?: number;
    txHash: string;
    sourceChain: string;
    destChain: string;
    sender: string;
    recipient: string;
    amount: string;
    nonce: number;
    timestamp: number;
    leafHash: string;
    proof: string | null;
    merkleRoot: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    destTxHash: string | null;
    errorMessage: string | null;
    createdAt: number;
    updatedAt: number;
}

export class DatabaseService {
    private db: SqlJsDatabase | null = null;
    private dbPath: string;
    private initialized = false;

    constructor() {
        this.dbPath = config.database.url;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        logger.info('Initializing database...');

        const SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        } else {
            this.db = new SQL.Database();
        }

        // Create bridge_transactions table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS bridge_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        txHash TEXT NOT NULL UNIQUE,
        sourceChain TEXT NOT NULL,
        destChain TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        amount TEXT NOT NULL,
        nonce INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        leafHash TEXT NOT NULL,
        proof TEXT,
        merkleRoot TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        destTxHash TEXT,
        errorMessage TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

        // Create indexes
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON bridge_transactions(status)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_nonce ON bridge_transactions(nonce)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_sourceChain ON bridge_transactions(sourceChain)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_leafHash ON bridge_transactions(leafHash)`);

        // Create merkle_roots table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS merkle_roots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        root TEXT NOT NULL UNIQUE,
        chain TEXT NOT NULL,
        transactionCount INTEGER NOT NULL,
        registered BOOLEAN NOT NULL DEFAULT 0,
        registrationTxHash TEXT,
        createdAt INTEGER NOT NULL
      )
    `);

        this.save();
        this.initialized = true;
        logger.info('Database initialized successfully');
    }

    private save(): void {
        if (!this.db) throw new Error('Database not initialized');
        const data = this.db.export();
        const buffer = Buffer.from(data);
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dbPath, buffer);
    }

    // Transaction operations
    insertTransaction(tx: Omit<BridgeTransaction, 'id'>): number {
        if (!this.db) throw new Error('Database not initialized');

        this.db.run(
            `INSERT INTO bridge_transactions (
        txHash, sourceChain, destChain, sender, recipient,
        amount, nonce, timestamp, leafHash, proof, merkleRoot,
        status, destTxHash, errorMessage, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tx.txHash,
                tx.sourceChain,
                tx.destChain,
                tx.sender,
                tx.recipient,
                tx.amount,
                tx.nonce,
                tx.timestamp,
                tx.leafHash,
                tx.proof,
                tx.merkleRoot,
                tx.status,
                tx.destTxHash,
                tx.errorMessage,
                tx.createdAt,
                tx.updatedAt,
            ]
        );

        const result = this.db.exec('SELECT last_insert_rowid() as id');
        this.save();
        return result[0].values[0][0] as number;
    }

    getTransaction(txHash: string): BridgeTransaction | undefined {
        if (!this.db) throw new Error('Database not initialized');

        const result = this.db.exec('SELECT * FROM bridge_transactions WHERE txHash = ?', [txHash]);
        if (result.length === 0 || result[0].values.length === 0) return undefined;

        return this.rowToTransaction(result[0].columns, result[0].values[0]);
    }

    getTransactionByLeafHash(leafHash: string): BridgeTransaction | undefined {
        if (!this.db) throw new Error('Database not initialized');

        const result = this.db.exec('SELECT * FROM bridge_transactions WHERE leafHash = ?', [leafHash]);
        if (result.length === 0 || result[0].values.length === 0) return undefined;

        return this.rowToTransaction(result[0].columns, result[0].values[0]);
    }

    getPendingTransactions(): BridgeTransaction[] {
        if (!this.db) throw new Error('Database not initialized');

        const result = this.db.exec(`
      SELECT * FROM bridge_transactions 
      WHERE status = 'pending' 
      ORDER BY createdAt ASC
    `);

        if (result.length === 0) return [];
        return result[0].values.map((row: any[]) => this.rowToTransaction(result[0].columns, row));
    }

    getProcessingTransactions(): BridgeTransaction[] {
        if (!this.db) throw new Error('Database not initialized');

        const result = this.db.exec(`
      SELECT * FROM bridge_transactions 
      WHERE status = 'processing' 
      ORDER BY createdAt ASC
    `);

        if (result.length === 0) return [];
        return result[0].values.map((row: any[]) => this.rowToTransaction(result[0].columns, row));
    }

    updateTransactionStatus(
        txHash: string,
        status: BridgeTransaction['status'],
        updates: Partial<BridgeTransaction> = {}
    ): void {
        if (!this.db) throw new Error('Database not initialized');

        const fields = ['status = ?', 'updatedAt = ?'];
        const values: any[] = [status, Date.now()];

        if (updates.proof !== undefined) {
            fields.push('proof = ?');
            values.push(updates.proof);
        }
        if (updates.merkleRoot !== undefined) {
            fields.push('merkleRoot = ?');
            values.push(updates.merkleRoot);
        }
        if (updates.destTxHash !== undefined) {
            fields.push('destTxHash = ?');
            values.push(updates.destTxHash);
        }
        if (updates.errorMessage !== undefined) {
            fields.push('errorMessage = ?');
            values.push(updates.errorMessage);
        }

        values.push(txHash);

        this.db.run(
            `UPDATE bridge_transactions SET ${fields.join(', ')} WHERE txHash = ?`,
            values
        );

        this.save();
    }

    // Merkle root operations
    insertMerkleRoot(root: string, chain: string, transactionCount: number): number {
        if (!this.db) throw new Error('Database not initialized');

        this.db.run(
            `INSERT INTO merkle_roots (root, chain, transactionCount, createdAt) VALUES (?, ?, ?, ?)`,
            [root, chain, transactionCount, Date.now()]
        );

        const result = this.db.exec('SELECT last_insert_rowid() as id');
        this.save();
        return result[0].values[0][0] as number;
    }

    markRootAsRegistered(root: string, registrationTxHash: string): void {
        if (!this.db) throw new Error('Database not initialized');

        this.db.run(
            `UPDATE merkle_roots SET registered = 1, registrationTxHash = ? WHERE root = ?`,
            [registrationTxHash, root]
        );

        this.save();
    }

    getUnregisteredRoots(chain: string): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const result = this.db.exec(
            `SELECT * FROM merkle_roots WHERE chain = ? AND registered = 0 ORDER BY createdAt ASC`,
            [chain]
        );

        if (result.length === 0) return [];
        return result[0].values.map((row: any[]) => this.rowToObject(result[0].columns, row));
    }

    // Statistics
    getStats() {
        if (!this.db) throw new Error('Database not initialized');

        const total = this.db.exec('SELECT COUNT(*) as count FROM bridge_transactions');
        const pending = this.db.exec("SELECT COUNT(*) as count FROM bridge_transactions WHERE status = 'pending'");
        const processing = this.db.exec("SELECT COUNT(*) as count FROM bridge_transactions WHERE status = 'processing'");
        const completed = this.db.exec("SELECT COUNT(*) as count FROM bridge_transactions WHERE status = 'completed'");
        const failed = this.db.exec("SELECT COUNT(*) as count FROM bridge_transactions WHERE status = 'failed'");

        return {
            total: total[0]?.values[0]?.[0] || 0,
            pending: pending[0]?.values[0]?.[0] || 0,
            processing: processing[0]?.values[0]?.[0] || 0,
            completed: completed[0]?.values[0]?.[0] || 0,
            failed: failed[0]?.values[0]?.[0] || 0,
        };
    }

    close(): void {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }

    private rowToTransaction(columns: string[], values: any[]): BridgeTransaction {
        const obj: any = {};
        columns.forEach((col, idx) => {
            obj[col] = values[idx];
        });
        return obj as BridgeTransaction;
    }

    private rowToObject(columns: string[], values: any[]): any {
        const obj: any = {};
        columns.forEach((col, idx) => {
            obj[col] = values[idx];
        });
        return obj;
    }
}

let dbInstance: DatabaseService | null = null;

export const getDb = async (): Promise<DatabaseService> => {
    if (!dbInstance) {
        dbInstance = new DatabaseService();
        await dbInstance.initialize();
    }
    return dbInstance;
};

export const db = dbInstance as any; // For backward compatibility, but should use getDb() instead
