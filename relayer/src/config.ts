import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

export interface Config {
    // Network Configuration
    sepolia: {
        rpcUrl: string;
        chainId: number;
        bridgeVault: string;
        bridgeValidator: string;
    };
    amoy: {
        rpcUrl: string;
        chainId: number;
        bridgeToken: string;
        bridgeValidator: string;
    };

    // Relayer Configuration
    relayer: {
        privateKey: string;
        port: number;
    };

    // Database Configuration
    database: {
        url: string;
    };

    // Logging Configuration
    logging: {
        level: string;
    };

    // Processing Configuration
    processing: {
        confirmations: {
            sepolia: number;
            amoy: number;
        };
        pollingInterval: number; // milliseconds
        retryAttempts: number;
        retryDelay: number; // milliseconds
    };
}

const config: Config = {
    sepolia: {
        rpcUrl: process.env.SEPOLIA_RPC_URL || '',
        chainId: 11155111,
        bridgeVault: process.env.SEPOLIA_BRIDGE_VAULT || '',
        bridgeValidator: process.env.SEPOLIA_BRIDGE_VALIDATOR || '',
    },
    amoy: {
        rpcUrl: process.env.AMOY_RPC_URL || '',
        chainId: 80002, // Amoy Chain ID
        bridgeToken: process.env.AMOY_BRIDGE_TOKEN || '',
        bridgeValidator: process.env.AMOY_BRIDGE_VALIDATOR || '',
    },
    relayer: {
        privateKey: process.env.RELAYER_PRIVATE_KEY || '',
        port: parseInt(process.env.RELAYER_PORT || '3001'),
    },
    database: {
        url: process.env.DATABASE_URL || './relayer.db',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
    processing: {
        confirmations: {
            sepolia: 3,
            amoy: 5,
        },
        pollingInterval: 15000, // 15 seconds
        retryAttempts: 3,
        retryDelay: 5000, // 5 seconds
    },
};

// Validate configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.sepolia.rpcUrl) errors.push('SEPOLIA_RPC_URL is required');
    if (!config.amoy.rpcUrl) errors.push('AMOY_RPC_URL is required');
    if (!config.relayer.privateKey) errors.push('RELAYER_PRIVATE_KEY is required');
    if (!config.sepolia.bridgeVault) errors.push('SEPOLIA_BRIDGE_VAULT is required');
    if (!config.amoy.bridgeToken) errors.push('AMOY_BRIDGE_TOKEN is required');
    if (!config.sepolia.bridgeValidator) errors.push('SEPOLIA_BRIDGE_VALIDATOR is required');
    if (!config.amoy.bridgeValidator) errors.push('AMOY_BRIDGE_VALIDATOR is required');

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        console.error('\nPlease check your .env file');
        process.exit(1);
    }
}

export default config;

