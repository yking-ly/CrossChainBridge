import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, polygonAmoy } from 'wagmi/chains';

// Get WalletConnect project ID from environment
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
    console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID is not set');
}

export const config = getDefaultConfig({
    appName: 'Cross-Chain Bridge',
    projectId,
    chains: [sepolia, polygonAmoy],
    ssr: false,
});

// Contract addresses
export const CONTRACTS = {
    sepolia: {
        bridgeVault: (import.meta.env.VITE_SEPOLIA_BRIDGE_VAULT || '') as `0x${string}`,
        bridgeValidator: (import.meta.env.VITE_SEPOLIA_BRIDGE_VALIDATOR || '') as `0x${string}`,
    },
    amoy: {
        bridgeToken: (import.meta.env.VITE_AMOY_BRIDGE_TOKEN || '') as `0x${string}`,
        bridgeValidator: (import.meta.env.VITE_AMOY_BRIDGE_VALIDATOR || '') as `0x${string}`,
    },
};

// Chain configuration
export const CHAIN_CONFIG = {
    [sepolia.id]: {
        name: 'Sepolia',
        nativeCurrency: 'ETH',
        explorer: 'https://sepolia.etherscan.io',
        faucets: [
            'https://sepoliafaucet.com',
            'https://faucet.quicknode.com/ethereum/sepolia',
        ],
    },
    [polygonAmoy.id]: {
        name: 'Amoy',
        nativeCurrency: 'MATIC',
        explorer: 'https://amoy.polygonscan.com',
        faucets: [
            'https://faucet.polygon.technology',
            'https://www.alchemy.com/faucets/polygon-amoy',
        ],
    },
};
