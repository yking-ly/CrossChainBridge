import { formatEther, parseEther } from 'viem';

/**
 * Formats wei to ETH with specified decimals
 */
export function formatAmount(wei: bigint, decimals: number = 4): string {
    const eth = formatEther(wei);
    const num = parseFloat(eth);
    return num.toFixed(decimals);
}

/**
 * Parses ETH string to wei
 */
export function parseAmount(eth: string): bigint {
    try {
        return parseEther(eth);
    } catch {
        return 0n;
    }
}

/**
 * Truncates address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Formats timestamp to readable date
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Gets block explorer URL for transaction
 */
export function getExplorerUrl(chainId: number, txHash: string): string {
    const explorers: Record<number, string> = {
        11155111: 'https://sepolia.etherscan.io/tx',
        80001: 'https://mumbai.polygonscan.com/tx',
    };

    const baseUrl = explorers[chainId] || '';
    return `${baseUrl}/${txHash}`;
}

/**
 * Gets block explorer URL for address
 */
export function getAddressExplorerUrl(chainId: number, address: string): string {
    const explorers: Record<number, string> = {
        11155111: 'https://sepolia.etherscan.io/address',
        80001: 'https://mumbai.polygonscan.com/address',
    };

    const baseUrl = explorers[chainId] || '';
    return `${baseUrl}/${address}`;
}

/**
 * Validates Ethereum address
 */
export function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Formats large numbers with commas
 */
export function formatNumber(num: number): string {
    return num.toLocaleString();
}

/**
 * Calculates estimated time for bridge
 */
export function getEstimatedTime(sourceChain: number): string {
    // Sepolia: ~15s block time, 3 confirmations = ~45s
    // Mumbai: ~2s block time, 5 confirmations = ~10s
    // Plus relayer processing time ~30s

    if (sourceChain === 11155111) {
        return '1-2 minutes';
    } else {
        return '1-2 minutes';
    }
}

/**
 * Gets chain name from ID
 */
export function getChainName(chainId: number): string {
    const names: Record<number, string> = {
        11155111: 'Sepolia',
        80001: 'Mumbai',
    };

    return names[chainId] || 'Unknown';
}

/**
 * Gets native currency symbol
 */
export function getNativeCurrency(chainId: number): string {
    const currencies: Record<number, string> = {
        11155111: 'ETH',
        80001: 'MATIC',
    };

    return currencies[chainId] || 'ETH';
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Delays execution
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates amount
 */
export function validateAmount(amount: string, max?: bigint): {
    valid: boolean;
    error?: string;
} {
    if (!amount || amount === '0') {
        return { valid: false, error: 'Amount is required' };
    }

    try {
        const wei = parseEther(amount);

        if (wei <= 0n) {
            return { valid: false, error: 'Amount must be greater than 0' };
        }

        if (wei < parseEther('0.001')) {
            return { valid: false, error: 'Minimum amount is 0.001 ETH' };
        }

        if (max && wei > max) {
            return { valid: false, error: `Maximum amount is ${formatEther(max)} ETH` };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid amount' };
    }
}
