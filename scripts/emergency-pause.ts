import { ethers } from 'hardhat';
import { loadDeployment } from './helpers';

/**
 * Emergency pause script for all bridge contracts
 * Use this in case of security incidents or bugs
 * 
 * Usage:
 *   npx hardhat run scripts/emergency-pause.ts --network sepolia
 *   npx hardhat run scripts/emergency-pause.ts --network amoy
 */
async function main() {
    const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
    const [deployer] = await ethers.getSigners();

    console.log('\n' + '='.repeat(60));
    console.log('⚠️  EMERGENCY PAUSE');
    console.log('='.repeat(60));
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log('='.repeat(60));

    // Confirmation warning
    console.log('\n⚠️  WARNING: This will PAUSE all bridge operations!');
    console.log('   - Users will NOT be able to lock/unlock ETH');
    console.log('   - Users will NOT be able to mint/burn tokens');
    console.log('   - Relayer will NOT be able to process transactions');
    console.log('\n   Only use this in case of emergency!');
    console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Load deployment
    let deployment;
    try {
        deployment = loadDeployment(networkName);
    } catch (error) {
        console.error(`\n❌ No deployment found for ${networkName}`);
        process.exit(1);
    }

    const { contracts } = deployment;

    // Pause contracts based on network
    if (networkName === 'sepolia') {
        await pauseSepoliaContracts(contracts);
    } else if (networkName === 'amoy') {
        await pauseamoyContracts(contracts);
    } else {
        console.error(`\n❌ Unsupported network: ${networkName}`);
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ EMERGENCY PAUSE COMPLETE');
    console.log('='.repeat(60));
    console.log('\nTo resume operations, run:');
    console.log(`  npx hardhat run scripts/emergency-unpause.ts --network ${networkName}`);
    console.log('='.repeat(60));
}

/**
 * Pauses Sepolia contracts
 */
async function pauseSepoliaContracts(contracts: Record<string, string>): Promise<void> {
    console.log('\n🛑 Pausing Sepolia Contracts...\n');

    // Pause BridgeVault
    console.log('Pausing BridgeVault...');
    const BridgeVault = await ethers.getContractFactory('BridgeVault');
    const vault = BridgeVault.attach(contracts.BridgeVault);

    try {
        const isPaused = await vault.paused();
        if (isPaused) {
            console.log('  ℹ️  BridgeVault is already paused');
        } else {
            const tx = await vault.pause();
            console.log(`  Transaction: ${tx.hash}`);
            await tx.wait();
            console.log('  ✅ BridgeVault paused successfully');
        }
    } catch (error) {
        console.error('  ❌ Error pausing BridgeVault:', (error as Error).message);
    }

    // Pause BridgeValidator
    console.log('\nPausing BridgeValidator...');
    const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
    const validator = BridgeValidator.attach(contracts.BridgeValidator);

    try {
        const isPaused = await validator.paused();
        if (isPaused) {
            console.log('  ℹ️  BridgeValidator is already paused');
        } else {
            const tx = await validator.pause();
            console.log(`  Transaction: ${tx.hash}`);
            await tx.wait();
            console.log('  ✅ BridgeValidator paused successfully');
        }
    } catch (error) {
        console.error('  ❌ Error pausing BridgeValidator:', (error as Error).message);
    }
}

/**
 * Pauses amoy contracts
 */
async function pauseamoyContracts(contracts: Record<string, string>): Promise<void> {
    console.log('\n🛑 Pausing amoy Contracts...\n');

    // Pause BridgeToken
    console.log('Pausing BridgeToken...');
    const BridgeToken = await ethers.getContractFactory('BridgeToken');
    const token = BridgeToken.attach(contracts.BridgeToken);

    try {
        const isPaused = await token.paused();
        if (isPaused) {
            console.log('  ℹ️  BridgeToken is already paused');
        } else {
            const tx = await token.pause();
            console.log(`  Transaction: ${tx.hash}`);
            await tx.wait();
            console.log('  ✅ BridgeToken paused successfully');
        }
    } catch (error) {
        console.error('  ❌ Error pausing BridgeToken:', (error as Error).message);
    }

    // Pause BridgeValidator
    console.log('\nPausing BridgeValidator...');
    const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
    const validator = BridgeValidator.attach(contracts.BridgeValidator);

    try {
        const isPaused = await validator.paused();
        if (isPaused) {
            console.log('  ℹ️  BridgeValidator is already paused');
        } else {
            const tx = await validator.pause();
            console.log(`  Transaction: ${tx.hash}`);
            await tx.wait();
            console.log('  ✅ BridgeValidator paused successfully');
        }
    } catch (error) {
        console.error('  ❌ Error pausing BridgeValidator:', (error as Error).message);
    }
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Emergency pause failed:');
        console.error(error);
        process.exit(1);
    });

