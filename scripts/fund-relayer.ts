import { ethers } from 'hardhat';

/**
 * Funds the relayer address with testnet tokens
 * This is a helper script to send ETH/MATIC to the relayer
 * 
 * Usage:
 *   npx hardhat run scripts/fund-relayer.ts --network sepolia
 *   npx hardhat run scripts/fund-relayer.ts --network amoy
 */
async function main() {
    const networkName = process.env.HARDHAT_NETWORK || 'hardhat';
    const [deployer] = await ethers.getSigners();

    console.log('\n' + '='.repeat(60));
    console.log('FUND RELAYER');
    console.log('='.repeat(60));
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log('='.repeat(60));

    // Get relayer address from environment
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
        console.error('\n❌ Error: RELAYER_PRIVATE_KEY not found in .env');
        console.error('   Please add your relayer private key to .env file');
        process.exit(1);
    }

    const relayerWallet = new ethers.Wallet(relayerPrivateKey, ethers.provider);
    const relayerAddress = relayerWallet.address;

    console.log(`\nRelayer Address: ${relayerAddress}`);

    // Check current balances
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    const relayerBalance = await ethers.provider.getBalance(relayerAddress);

    console.log(`\nCurrent Balances:`);
    console.log(`  Deployer: ${ethers.formatEther(deployerBalance)} ETH`);
    console.log(`  Relayer:  ${ethers.formatEther(relayerBalance)} ETH`);

    // Determine amount to send based on network
    let amountToSend: bigint;
    let minRequired: bigint;

    if (networkName === 'sepolia') {
        minRequired = ethers.parseEther('0.05'); // 0.05 ETH for Sepolia
        amountToSend = ethers.parseEther('0.1'); // Send 0.1 ETH
    } else if (networkName === 'amoy') {
        minRequired = ethers.parseEther('0.5'); // 0.5 MATIC for amoy
        amountToSend = ethers.parseEther('1.0'); // Send 1 MATIC
    } else {
        console.error(`\n❌ Unsupported network: ${networkName}`);
        process.exit(1);
    }

    // Check if relayer already has enough
    if (relayerBalance >= minRequired) {
        console.log(`\n✅ Relayer already has sufficient balance (${ethers.formatEther(relayerBalance)} ETH)`);
        console.log(`   Minimum required: ${ethers.formatEther(minRequired)} ETH`);
        console.log('\nNo funding needed!');
        return;
    }

    // Check if deployer has enough to send
    if (deployerBalance < amountToSend) {
        console.error(`\n❌ Error: Insufficient deployer balance`);
        console.error(`   Required: ${ethers.formatEther(amountToSend)} ETH`);
        console.error(`   Available: ${ethers.formatEther(deployerBalance)} ETH`);
        console.error('\nPlease fund your deployer address first!');

        // Print faucet links
        console.log('\n📌 Testnet Faucets:');
        if (networkName === 'sepolia') {
            console.log('   - https://sepoliafaucet.com');
            console.log('   - https://faucet.quicknode.com/ethereum/sepolia');
        } else if (networkName === 'amoy') {
            console.log('   - https://faucet.polygon.technology');
            console.log('   - https://amoyfaucet.com');
        }

        process.exit(1);
    }

    // Send funds
    console.log(`\n💸 Sending ${ethers.formatEther(amountToSend)} ETH to relayer...`);

    try {
        const tx = await deployer.sendTransaction({
            to: relayerAddress,
            value: amountToSend,
        });

        console.log(`\nTransaction Hash: ${tx.hash}`);
        console.log('Waiting for confirmation...');

        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

        // Check new balances
        const newDeployerBalance = await ethers.provider.getBalance(deployer.address);
        const newRelayerBalance = await ethers.provider.getBalance(relayerAddress);

        console.log(`\nNew Balances:`);
        console.log(`  Deployer: ${ethers.formatEther(newDeployerBalance)} ETH`);
        console.log(`  Relayer:  ${ethers.formatEther(newRelayerBalance)} ETH`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ RELAYER FUNDED SUCCESSFULLY');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('\n❌ Error sending transaction:');
        console.error(error);
        process.exit(1);
    }
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Funding failed:');
        console.error(error);
        process.exit(1);
    });

