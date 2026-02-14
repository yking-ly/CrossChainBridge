import { ethers, network } from 'hardhat';
import fs from 'fs';
import path from 'path';

/**
 * Saves deployment information to a JSON file
 */
export async function saveDeployment(
    chainName: string,
    contracts: Record<string, string>,
    deployer: string
): Promise<void> {
    const deploymentDir = path.join(__dirname, '../../deployments');

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentDir, `${chainName}.json`);

    const deployment = {
        network: chainName,
        chainId: network.config.chainId,
        deployer,
        contracts,
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
    };

    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log(`\n✅ Deployment info saved to ${deploymentFile}`);
}

/**
 * Loads deployment information from a JSON file
 */
export function loadDeployment(chainName: string): any {
    const deploymentFile = path.join(__dirname, '../../deployments', `${chainName}.json`);

    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found: ${deploymentFile}`);
    }

    const data = fs.readFileSync(deploymentFile, 'utf-8');
    return JSON.parse(data);
}

/**
 * Waits for a specified number of block confirmations
 */
export async function waitForConfirmations(
    txHash: string,
    confirmations: number = 5
): Promise<void> {
    console.log(`\nWaiting for ${confirmations} confirmations...`);
    const receipt = await ethers.provider.waitForTransaction(txHash, confirmations);

    if (!receipt) {
        throw new Error('Transaction receipt not found');
    }

    if (receipt.status === 0) {
        throw new Error('Transaction failed');
    }

    console.log(`✅ Transaction confirmed with ${confirmations} confirmations`);
}

/**
 * Gets the current gas price with a multiplier for faster confirmation
 */
export async function getGasPrice(multiplier: number = 1.2): Promise<bigint> {
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    if (!gasPrice) {
        throw new Error('Could not fetch gas price');
    }

    return (gasPrice * BigInt(Math.floor(multiplier * 100))) / 100n;
}

/**
 * Estimates gas for a transaction with a buffer
 */
export async function estimateGasWithBuffer(
    contract: any,
    method: string,
    args: any[],
    buffer: number = 1.2
): Promise<bigint> {
    const estimated = await contract[method].estimateGas(...args);
    return (estimated * BigInt(Math.floor(buffer * 100))) / 100n;
}

/**
 * Checks if an address is a contract
 */
export async function isContract(address: string): Promise<boolean> {
    const code = await ethers.provider.getCode(address);
    return code !== '0x';
}

/**
 * Validates contract deployment
 */
export async function validateDeployment(
    contractAddress: string,
    contractName: string
): Promise<void> {
    console.log(`\nValidating ${contractName} deployment...`);

    if (!ethers.isAddress(contractAddress)) {
        throw new Error(`Invalid address: ${contractAddress}`);
    }

    const isContractDeployed = await isContract(contractAddress);
    if (!isContractDeployed) {
        throw new Error(`No contract found at address: ${contractAddress}`);
    }

    console.log(`✅ ${contractName} validated at ${contractAddress}`);
}

/**
 * Formats Ether amount for display
 */
export function formatEther(amount: bigint): string {
    return ethers.formatEther(amount);
}

/**
 * Parses Ether amount from string
 */
export function parseEther(amount: string): bigint {
    return ethers.parseEther(amount);
}

/**
 * Gets network name from chain ID
 */
export function getNetworkName(chainId: number): string {
    const networks: Record<number, string> = {
        1: 'mainnet',
        5: 'goerli',
        11155111: 'sepolia',
        137: 'polygon',
        80002: 'amoy',
        31337: 'hardhat',
    };

    return networks[chainId] || 'unknown';
}

/**
 * Gets block explorer URL for the current network
 */
export function getExplorerUrl(chainId: number): string {
    const explorers: Record<number, string> = {
        1: 'https://etherscan.io',
        5: 'https://goerli.etherscan.io',
        11155111: 'https://sepolia.etherscan.io',
        137: 'https://polygonscan.com',
        80002: 'https://amoy.polygonscan.com',
    };

    return explorers[chainId] || '';
}

/**
 * Prints deployment summary
 */
export function printDeploymentSummary(
    chainName: string,
    contracts: Record<string, string>,
    deployer: string,
    chainId: number
): void {
    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Network: ${chainName} (Chain ID: ${chainId})`);
    console.log(`Deployer: ${deployer}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('\nDeployed Contracts:');
    console.log('-'.repeat(60));

    for (const [name, address] of Object.entries(contracts)) {
        console.log(`${name.padEnd(25)} ${address}`);
    }

    console.log('='.repeat(60));
}

/**
 * Prints verification instructions
 */
export function printVerificationInstructions(
    chainName: string,
    contracts: Record<string, string>
): void {
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION INSTRUCTIONS');
    console.log('='.repeat(60));
    console.log('\nTo verify contracts on block explorer, run:');
    console.log('-'.repeat(60));

    for (const [name, address] of Object.entries(contracts)) {
        console.log(`\nnpx hardhat verify --network ${chainName} ${address}`);
    }

    console.log('\n' + '='.repeat(60));
}

/**
 * Checks deployer balance and warns if low
 */
export async function checkDeployerBalance(
    deployer: string,
    minBalance: bigint = ethers.parseEther('0.1')
): Promise<void> {
    const balance = await ethers.provider.getBalance(deployer);

    console.log(`\nDeployer balance: ${formatEther(balance)} ETH`);

    if (balance < minBalance) {
        console.warn(`⚠️  WARNING: Low balance! Minimum recommended: ${formatEther(minBalance)} ETH`);
        console.warn('   Deployment may fail due to insufficient funds.');
    }
}

/**
 * Generates a random salt for CREATE2 deployments
 */
export function generateSalt(): string {
    return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Sleeps for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw new Error('Max retries exceeded');
}

/**
 * Confirms action with user (for interactive scripts)
 */
export async function confirm(message: string): Promise<boolean> {
    // In automated environments, always return true
    if (process.env.CI || process.env.AUTOMATED) {
        return true;
    }

    // For interactive use, you'd implement readline here
    console.log(`\n${message}`);
    console.log('(Skipping confirmation in non-interactive mode)');
    return true;
}

/**
 * Formats transaction receipt for logging
 */
export function formatReceipt(receipt: any): string {
    return `
    Transaction Hash: ${receipt.hash}
    Block Number: ${receipt.blockNumber}
    Gas Used: ${receipt.gasUsed.toString()}
    Status: ${receipt.status === 1 ? 'Success' : 'Failed'}
  `;
}

