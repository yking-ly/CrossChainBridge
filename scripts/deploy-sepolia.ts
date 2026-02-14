import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for Ethereum Sepolia (Source Chain)
 * 
 * Deploys:
 * 1. BridgeValidator
 * 2. BridgeVault
 * 
 * Saves deployment addresses to deployments/sepolia.json
 */
async function main() {
    console.log("🚀 Starting deployment to Ethereum Sepolia...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

    if (balance === 0n) {
        console.error("❌ Error: Deployer account has no ETH!");
        console.log("Get Sepolia ETH from:");
        console.log("  - https://sepoliafaucet.com");
        console.log("  - https://faucet.quicknode.com/ethereum/sepolia");
        process.exit(1);
    }

    // Get chain IDs
    const network = await ethers.provider.getNetwork();
    const sourceChainId = network.chainId;
    const destinationChainId = 80002n; // amoy chain ID

    console.log("🔗 Source Chain ID (Sepolia):", sourceChainId.toString());
    console.log("🔗 Destination Chain ID (amoy):", destinationChainId.toString());
    console.log();

    // Get relayer address (use deployer if not set)
    const relayerAddress = process.env.RELAYER_PRIVATE_KEY
        ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address
        : deployer.address;

    console.log("🤖 Relayer address:", relayerAddress);
    console.log();

    // Deploy BridgeValidator
    console.log("📦 Deploying BridgeValidator...");
    const BridgeValidator = await ethers.getContractFactory("BridgeValidator");
    const validator = await BridgeValidator.deploy(relayerAddress);
    await validator.waitForDeployment();
    const validatorAddress = await validator.getAddress();
    console.log("✅ BridgeValidator deployed to:", validatorAddress);
    console.log();

    // Deploy BridgeVault
    console.log("📦 Deploying BridgeVault...");
    const BridgeVault = await ethers.getContractFactory("BridgeVault");
    const vault = await BridgeVault.deploy(validatorAddress, destinationChainId);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ BridgeVault deployed to:", vaultAddress);
    console.log();

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const vaultValidator = await vault.validator();
    const vaultDestChainId = await vault.destinationChainId();

    console.log("  Vault validator:", vaultValidator);
    console.log("  Vault destination chain:", vaultDestChainId.toString());
    console.log();

    // Save deployment info
    const deploymentInfo = {
        network: "sepolia",
        chainId: sourceChainId.toString(),
        deployer: deployer.address,
        relayer: relayerAddress,
        timestamp: new Date().toISOString(),
        contracts: {
            BridgeValidator: {
                address: validatorAddress,
                args: [relayerAddress],
            },
            BridgeVault: {
                address: vaultAddress,
                args: [validatorAddress, destinationChainId.toString()],
            },
        },
    };

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save to file
    const deploymentPath = path.join(deploymentsDir, "sepolia.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("💾 Deployment info saved to:", deploymentPath);
    console.log();

    // Print summary
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY - ETHEREUM SEPOLIA");
    console.log("=".repeat(60));
    console.log("BridgeValidator:", validatorAddress);
    console.log("BridgeVault:    ", vaultAddress);
    console.log("=".repeat(60));
    console.log();

    // Print next steps
    console.log("📝 NEXT STEPS:");
    console.log("1. Update your .env file with these addresses:");
    console.log(`   SEPOLIA_BRIDGE_VALIDATOR=${validatorAddress}`);
    console.log(`   SEPOLIA_BRIDGE_VAULT=${vaultAddress}`);
    console.log();
    console.log("2. Verify contracts on Etherscan:");
    console.log(`   npx hardhat verify --network sepolia ${validatorAddress} "${relayerAddress}"`);
    console.log(`   npx hardhat verify --network sepolia ${vaultAddress} "${validatorAddress}" "${destinationChainId}"`);
    console.log();
    console.log("3. Deploy to amoy:");
    console.log("   npm run deploy:amoy");
    console.log();
    console.log("4. Fund the vault with some ETH for testing (optional)");
    console.log();

    // Print block explorer links
    console.log("🔗 View on Etherscan:");
    console.log(`   Validator: https://sepolia.etherscan.io/address/${validatorAddress}`);
    console.log(`   Vault:     https://sepolia.etherscan.io/address/${vaultAddress}`);
    console.log();

    console.log("✨ Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });

