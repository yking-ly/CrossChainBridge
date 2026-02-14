import { ethers } from 'hardhat';
import { loadDeployment } from './helpers';

/**
 * Checks balances of all deployed contracts and key addresses
 * 
 * Usage:
 *   npx hardhat run scripts/check-balances.ts --network sepolia
 *   npx hardhat run scripts/check-balances.ts --network amoy
 */
async function main() {
    const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
    const [deployer] = await ethers.getSigners();

    console.log('\n' + '='.repeat(60));
    console.log('BALANCE CHECK');
    console.log('='.repeat(60));
    console.log(`Network: ${networkName}`);
    console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
    console.log('='.repeat(60));

    // Load deployment
    let deployment;
    try {
        deployment = loadDeployment(networkName);
    } catch (error) {
        console.error(`\n❌ No deployment found for ${networkName}`);
        console.error('   Deploy contracts first before checking balances');
        process.exit(1);
    }

    const { contracts } = deployment;

    // Check deployer balance
    console.log('\n📊 DEPLOYER BALANCE');
    console.log('-'.repeat(60));
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Address: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(deployerBalance)} ETH`);

    if (deployerBalance < ethers.parseEther('0.01')) {
        console.log('⚠️  WARNING: Low balance!');
    }

    // Check relayer balance (if available in env)
    if (process.env.RELAYER_PRIVATE_KEY) {
        console.log('\n📊 RELAYER BALANCE');
        console.log('-'.repeat(60));
        const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, ethers.provider);
        const relayerBalance = await ethers.provider.getBalance(relayerWallet.address);
        console.log(`Address: ${relayerWallet.address}`);
        console.log(`Balance: ${ethers.formatEther(relayerBalance)} ETH`);

        if (relayerBalance < ethers.parseEther('0.01')) {
            console.log('⚠️  WARNING: Low balance! Relayer may not be able to process transactions');
        }
    }

    // Check contract balances and stats
    if (networkName === 'sepolia') {
        await checkSepoliaContracts(contracts);
    } else if (networkName === 'amoy') {
        await checkamoyContracts(contracts);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ BALANCE CHECK COMPLETE');
    console.log('='.repeat(60));
}

/**
 * Checks Sepolia contract balances and stats
 */
async function checkSepoliaContracts(contracts: Record<string, string>): Promise<void> {
    console.log('\n📊 BRIDGE VAULT (SEPOLIA)');
    console.log('-'.repeat(60));

    const BridgeVault = await ethers.getContractFactory('BridgeVault');
    const vault = BridgeVault.attach(contracts.BridgeVault);

    // Get vault balance
    const vaultBalance = await ethers.provider.getBalance(contracts.BridgeVault);
    console.log(`Contract Address: ${contracts.BridgeVault}`);
    console.log(`ETH Balance: ${ethers.formatEther(vaultBalance)} ETH`);

    // Get vault stats
    try {
        const stats = await vault.getStats();
        console.log(`\nVault Statistics:`);
        console.log(`  Total Locked:     ${ethers.formatEther(stats[0])} ETH`);
        console.log(`  Total Unlocked:   ${ethers.formatEther(stats[1])} ETH`);
        console.log(`  Current Balance:  ${ethers.formatEther(stats[2])} ETH`);
        console.log(`  Total Txs:        ${stats[3].toString()}`);
        console.log(`  Current Nonce:    ${stats[4].toString()}`);

        // Check if paused
        const isPaused = await vault.paused();
        console.log(`  Status:           ${isPaused ? '⏸️  PAUSED' : '✅ ACTIVE'}`);

        // Get max bridge amount
        const maxAmount = await vault.maxBridgeAmount();
        console.log(`  Max Bridge:       ${ethers.formatEther(maxAmount)} ETH`);
    } catch (error) {
        console.log('❌ Error fetching vault stats:', (error as Error).message);
    }

    // Check validator
    console.log('\n📊 BRIDGE VALIDATOR (SEPOLIA)');
    console.log('-'.repeat(60));
    console.log(`Contract Address: ${contracts.BridgeValidator}`);

    const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
    const validator = BridgeValidator.attach(contracts.BridgeValidator);

    try {
        const relayer = await validator.relayer();
        const isPaused = await validator.paused();
        console.log(`  Relayer:          ${relayer}`);
        console.log(`  Status:           ${isPaused ? '⏸️  PAUSED' : '✅ ACTIVE'}`);
    } catch (error) {
        console.log('❌ Error fetching validator info:', (error as Error).message);
    }
}

/**
 * Checks amoy contract balances and stats
 */
async function checkamoyContracts(contracts: Record<string, string>): Promise<void> {
    console.log('\n📊 BRIDGE TOKEN (amoy)');
    console.log('-'.repeat(60));

    const BridgeToken = await ethers.getContractFactory('BridgeToken');
    const token = BridgeToken.attach(contracts.BridgeToken);

    console.log(`Contract Address: ${contracts.BridgeToken}`);

    // Get token info
    try {
        const name = await token.name();
        const symbol = await token.symbol();
        const totalSupply = await token.totalSupply();

        console.log(`  Name:             ${name}`);
        console.log(`  Symbol:           ${symbol}`);
        console.log(`  Total Supply:     ${ethers.formatEther(totalSupply)} ${symbol}`);

        // Get token stats
        const stats = await token.getStats();
        console.log(`\nToken Statistics:`);
        console.log(`  Total Minted:     ${ethers.formatEther(stats[0])} wSepETH`);
        console.log(`  Total Burned:     ${ethers.formatEther(stats[1])} wSepETH`);
        console.log(`  Current Supply:   ${ethers.formatEther(stats[2])} wSepETH`);
        console.log(`  Mint Txs:         ${stats[3].toString()}`);
        console.log(`  Burn Txs:         ${stats[4].toString()}`);
        console.log(`  Current Nonce:    ${stats[5].toString()}`);

        // Check if paused
        const isPaused = await token.paused();
        console.log(`  Status:           ${isPaused ? '⏸️  PAUSED' : '✅ ACTIVE'}`);
    } catch (error) {
        console.log('❌ Error fetching token stats:', (error as Error).message);
    }

    // Check validator
    console.log('\n📊 BRIDGE VALIDATOR (amoy)');
    console.log('-'.repeat(60));
    console.log(`Contract Address: ${contracts.BridgeValidator}`);

    const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
    const validator = BridgeValidator.attach(contracts.BridgeValidator);

    try {
        const relayer = await validator.relayer();
        const isPaused = await validator.paused();
        console.log(`  Relayer:          ${relayer}`);
        console.log(`  Status:           ${isPaused ? '⏸️  PAUSED' : '✅ ACTIVE'}`);
    } catch (error) {
        console.log('❌ Error fetching validator info:', (error as Error).message);
    }
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Error checking balances:');
        console.error(error);
        process.exit(1);
    });

