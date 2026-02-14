import { run } from 'hardhat';
import { loadDeployment } from './helpers';

/**
 * Verifies all deployed contracts on Etherscan/Polygonscan
 * 
 * Usage:
 *   npx hardhat run scripts/verify-contracts.ts --network sepolia
 *   npx hardhat run scripts/verify-contracts.ts --network amoy
 */
async function main() {
    const networkName = process.env.HARDHAT_NETWORK || 'hardhat';

    console.log('\n' + '='.repeat(60));
    console.log('CONTRACT VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Network: ${networkName}`);
    console.log('='.repeat(60));

    // Load deployment info
    let deployment;
    try {
        deployment = loadDeployment(networkName);
    } catch (error) {
        console.error(`\n❌ Error: Deployment file not found for ${networkName}`);
        console.error('   Please deploy contracts first using:');
        console.error(`   npx hardhat run scripts/deploy-${networkName}.ts --network ${networkName}`);
        process.exit(1);
    }

    const { contracts, deployer } = deployment;

    console.log(`\nDeployer: ${deployer}`);
    console.log(`\nContracts to verify:`);
    for (const [name, contractInfo] of Object.entries(contracts)) {
        const address = typeof contractInfo === 'string' ? contractInfo : (contractInfo as any).address;
        console.log(`  - ${name}: ${address}`);
    }

    // Verify based on network
    if (networkName === 'sepolia') {
        await verifySepoliaContracts(contracts, deployer);
    } else if (networkName === 'amoy') {
        await verifyamoyContracts(contracts, deployer);
    } else {
        console.error(`\n❌ Verification not supported for network: ${networkName}`);
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICATION COMPLETE');
    console.log('='.repeat(60));
}

/**
 * Verifies Sepolia contracts
 */
async function verifySepoliaContracts(
    contracts: Record<string, any>,
    relayerAddress: string
): Promise<void> {
    const DESTINATION_CHAIN_ID = 80002; // amoy

    console.log('\n📝 Verifying BridgeValidator...');
    await verifyContract(
        contracts.BridgeValidator.address,
        [relayerAddress],
        'BridgeValidator'
    );

    console.log('\n📝 Verifying BridgeVault...');
    await verifyContract(
        contracts.BridgeVault.address,
        [contracts.BridgeValidator.address, DESTINATION_CHAIN_ID],
        'BridgeVault'
    );
}

/**
 * Verifies amoy contracts
 */
async function verifyamoyContracts(
    contracts: Record<string, any>,
    relayerAddress: string
): Promise<void> {
    const SOURCE_CHAIN_ID = 11155111; // Sepolia

    console.log('\n📝 Verifying BridgeValidator...');
    await verifyContract(
        contracts.BridgeValidator.address,
        [relayerAddress],
        'BridgeValidator'
    );

    console.log('\n📝 Verifying BridgeToken...');
    await verifyContract(
        contracts.BridgeToken.address,
        [contracts.BridgeValidator.address, SOURCE_CHAIN_ID],
        'BridgeToken'
    );
}

/**
 * Verifies a single contract
 */
async function verifyContract(
    address: string,
    constructorArguments: any[],
    contractName: string
): Promise<void> {
    try {
        console.log(`\nVerifying ${contractName} at ${address}...`);
        console.log(`Constructor args: ${JSON.stringify(constructorArguments)}`);

        await run('verify:verify', {
            address,
            constructorArguments,
        });

        console.log(`✅ ${contractName} verified successfully!`);
    } catch (error: any) {
        if (error.message.includes('Already Verified')) {
            console.log(`ℹ️  ${contractName} is already verified`);
        } else if (error.message.includes('does not have bytecode')) {
            console.error(`❌ Error: No contract found at ${address}`);
            console.error('   Make sure the contract is deployed correctly');
        } else if (error.message.includes('Invalid API Key')) {
            console.error(`❌ Error: Invalid API key`);
            console.error('   Please check your ETHERSCAN_API_KEY or POLYGONSCAN_API_KEY in .env');
        } else {
            console.error(`❌ Error verifying ${contractName}:`);
            console.error(error.message);
        }
    }
}

/**
 * Alternative: Verify with contract path (if auto-detection fails)
 */
async function verifyContractWithPath(
    address: string,
    constructorArguments: any[],
    contractPath: string,
    contractName: string
): Promise<void> {
    try {
        console.log(`\nVerifying ${contractName} at ${address}...`);
        console.log(`Contract: ${contractPath}`);
        console.log(`Constructor args: ${JSON.stringify(constructorArguments)}`);

        await run('verify:verify', {
            address,
            constructorArguments,
            contract: contractPath,
        });

        console.log(`✅ ${contractName} verified successfully!`);
    } catch (error: any) {
        if (error.message.includes('Already Verified')) {
            console.log(`ℹ️  ${contractName} is already verified`);
        } else {
            console.error(`❌ Error verifying ${contractName}:`);
            console.error(error.message);
        }
    }
}

// Run the verification
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Verification failed:');
        console.error(error);
        process.exit(1);
    });

