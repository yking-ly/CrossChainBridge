import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for Polygon Amoy (Destination Chain)
 * 
 * Deploys:
 * 1. BridgeValidator
 * 2. BridgeToken
 * 
 * Saves deployment addresses to deployments/amoy.json
 */
async function main() {
    console.log("🚀 Starting deployment to Polygon Amoy...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "MATIC\n");

    if (balance === 0n) {
        console.error("❌ Error: Deployer account has no MATIC!");
        console.log("Get Amoy MATIC from:");
        console.log("  - https://faucet.polygon.technology");
        console.log("  - https://www.alchemy.com/faucets/polygon-amoy");
        process.exit(1);
    }

    // Get chain IDs
    const network = await ethers.provider.getNetwork();
    const destinationChainId = network.chainId;
    const sourceChainId = 11155111n; // Sepolia chain ID

    console.log("🔗 Destination Chain ID (Amoy):", destinationChainId.toString());
    console.log("🔗 Source Chain ID (Sepolia):", sourceChainId.toString());
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

    // Deploy BridgeToken
    console.log("📦 Deploying BridgeToken...");
    const BridgeToken = await ethers.getContractFactory("BridgeToken");
    const token = await BridgeToken.deploy(validatorAddress, sourceChainId);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("✅ BridgeToken deployed to:", tokenAddress);
    console.log();

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const tokenValidator = await token.validator();
    const tokenSourceChainId = await token.sourceChainId();
    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    const tokenDecimals = await token.decimals();

    console.log("  Token name:", tokenName);
    console.log("  Token symbol:", tokenSymbol);
    console.log("  Token decimals:", tokenDecimals);
    console.log("  Token validator:", tokenValidator);
    console.log("  Token source chain:", tokenSourceChainId.toString());
    console.log();

    // Save deployment info
    const deploymentInfo = {
        network: "amoy",
        chainId: destinationChainId.toString(),
        deployer: deployer.address,
        relayer: relayerAddress,
        timestamp: new Date().toISOString(),
        contracts: {
            BridgeValidator: {
                address: validatorAddress,
                args: [relayerAddress],
            },
            BridgeToken: {
                address: tokenAddress,
                args: [validatorAddress, sourceChainId.toString()],
                tokenInfo: {
                    name: tokenName,
                    symbol: tokenSymbol,
                    decimals: tokenDecimals,
                },
            },
        },
    };

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save to file
    const deploymentPath = path.join(deploymentsDir, "amoy.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("💾 Deployment info saved to:", deploymentPath);
    console.log();

    // Print summary
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY - POLYGON AMOY");
    console.log("=".repeat(60));
    console.log("BridgeValidator:", validatorAddress);
    console.log("BridgeToken:    ", tokenAddress);
    console.log("Token Name:     ", tokenName);
    console.log("Token Symbol:   ", tokenSymbol);
    console.log("=".repeat(60));
    console.log();

    // Print next steps
    console.log("📝 NEXT STEPS:");
    console.log("1. Update your .env file with these addresses:");
    console.log(`   AMOY_BRIDGE_VALIDATOR=${validatorAddress}`);
    console.log(`   AMOY_BRIDGE_TOKEN=${tokenAddress}`);
    console.log();
    console.log("2. Verify contracts on Polygonscan:");
    console.log(`   npx hardhat verify --network amoy ${validatorAddress} "${relayerAddress}"`);
    console.log(`   npx hardhat verify --network amoy ${tokenAddress} "${validatorAddress}" "${sourceChainId}"`);
    console.log();
    console.log("3. Configure the relayer with both chain addresses");
    console.log();
    console.log("4. Start the relayer service:");
    console.log("   cd relayer && npm run start");
    console.log();
    console.log("5. Start the frontend:");
    console.log("   cd frontend && npm run dev");
    console.log();

    // Print block explorer links
    console.log("🔗 View on Polygonscan:");
    console.log(`   Validator: https://amoy.polygonscan.com/address/${validatorAddress}`);
    console.log(`   Token:     https://amoy.polygonscan.com/address/${tokenAddress}`);
    console.log();

    // Print token import info for MetaMask
    console.log("📱 Add token to MetaMask:");
    console.log("   Token Address:", tokenAddress);
    console.log("   Token Symbol:", tokenSymbol);
    console.log("   Decimals:", tokenDecimals);
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

