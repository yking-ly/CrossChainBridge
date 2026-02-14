import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BridgeVault, BridgeToken, BridgeValidator } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Bridge Integration Tests', function () {
    let sepoliaValidator: BridgeValidator;
    let amoyValidator: BridgeValidator;
    let bridgeVault: BridgeVault;
    let bridgeToken: BridgeToken;

    let owner: SignerWithAddress;
    let relayer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const SEPOLIA_CHAIN_ID = 11155111;
    const amoy_CHAIN_ID = 80002;

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();

        // Deploy Sepolia contracts
        const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
        sepoliaValidator = await BridgeValidator.deploy(relayer.address);
        await sepoliaValidator.waitForDeployment();

        const BridgeVault = await ethers.getContractFactory('BridgeVault');
        bridgeVault = await BridgeVault.deploy(
            await sepoliaValidator.getAddress(),
            amoy_CHAIN_ID
        );
        await bridgeVault.waitForDeployment();

        // Deploy amoy contracts
        amoyValidator = await BridgeValidator.deploy(relayer.address);
        await amoyValidator.waitForDeployment();

        const BridgeToken = await ethers.getContractFactory('BridgeToken');
        bridgeToken = await BridgeToken.deploy(
            await amoyValidator.getAddress(),
            SEPOLIA_CHAIN_ID
        );
        await bridgeToken.waitForDeployment();
    });

    describe('Full Bridge Flow: Sepolia → amoy', function () {
        it('Should complete full bridge flow from Sepolia to amoy', async function () {
            const bridgeAmount = ethers.parseEther('1.0');
            const recipient = user2.address;

            // Step 1: User locks ETH on Sepolia
            const lockTx = await bridgeVault.connect(user1).lock(recipient, {
                value: bridgeAmount,
            });
            const lockReceipt = await lockTx.wait();

            // Extract event data
            const lockEvent = lockReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'BridgingInitiated'
            );
            expect(lockEvent).to.not.be.undefined;

            // Get nonce and timestamp from event
            const iface = bridgeVault.interface;
            const parsedLog = iface.parseLog({
                topics: [...lockEvent!.topics],
                data: lockEvent!.data,
            });

            const nonce = parsedLog!.args.nonce;
            const timestamp = parsedLog!.args.timestamp;
            const leafHash = parsedLog!.args.leafHash;

            // Verify vault state
            const vaultStats = await bridgeVault.getStats();
            expect(vaultStats[0]).to.equal(bridgeAmount); // totalLocked

            // Step 2: Relayer generates Merkle proof
            const merkleRoot = leafHash; // Single transaction tree
            const proof: string[] = []; // Empty proof for single leaf

            // Step 3: Relayer registers root on amoy
            await amoyValidator.connect(relayer).registerRoot(merkleRoot);

            // Step 4: Relayer submits mint transaction on amoy
            const sourceTxHash = lockReceipt!.hash;

            const mintTx = await bridgeToken.mint(
                user1.address,
                recipient,
                bridgeAmount,
                nonce,
                timestamp,
                sourceTxHash,
                proof,
                merkleRoot
            );
            await mintTx.wait();

            // Verify token was minted
            const balance = await bridgeToken.balanceOf(recipient);
            expect(balance).to.equal(bridgeAmount);

            // Verify token stats
            const tokenStats = await bridgeToken.getStats();
            expect(tokenStats[0]).to.equal(bridgeAmount); // totalMinted
            expect(tokenStats[2]).to.equal(bridgeAmount); // totalSupply
        });

        it('Should handle multiple sequential bridges', async function () {
            const amounts = [
                ethers.parseEther('0.5'),
                ethers.parseEther('1.0'),
                ethers.parseEther('0.25'),
            ];

            for (let i = 0; i < amounts.length; i++) {
                const amount = amounts[i];

                // Lock on Sepolia
                const lockTx = await bridgeVault.connect(user1).lock(user2.address, {
                    value: amount,
                });
                const lockReceipt = await lockTx.wait();

                // Extract event data
                const iface = bridgeVault.interface;
                const lockEvent = lockReceipt?.logs.find(
                    (log: any) => log.fragment?.name === 'BridgingInitiated'
                );
                const parsedLog = iface.parseLog({
                    topics: [...lockEvent!.topics],
                    data: lockEvent!.data,
                });

                const nonce = parsedLog!.args.nonce;
                const timestamp = parsedLog!.args.timestamp;
                const leafHash = parsedLog!.args.leafHash;

                // Register root and mint
                await amoyValidator.connect(relayer).registerRoot(leafHash);
                await bridgeToken.mint(
                    user1.address,
                    user2.address,
                    amount,
                    nonce,
                    timestamp,
                    lockReceipt!.hash,
                    [],
                    leafHash
                );
            }

            // Verify final balances
            const totalAmount = amounts.reduce((a, b) => a + b, 0n);
            expect(await bridgeToken.balanceOf(user2.address)).to.equal(totalAmount);
        });
    });

    describe('Full Bridge Flow: amoy → Sepolia (Reverse)', function () {
        beforeEach(async function () {
            // First bridge some tokens to amoy
            const bridgeAmount = ethers.parseEther('5.0');

            const lockTx = await bridgeVault.connect(user1).lock(user2.address, {
                value: bridgeAmount,
            });
            const lockReceipt = await lockTx.wait();

            const iface = bridgeVault.interface;
            const lockEvent = lockReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'BridgingInitiated'
            );
            const parsedLog = iface.parseLog({
                topics: [...lockEvent!.topics],
                data: lockEvent!.data,
            });

            const nonce = parsedLog!.args.nonce;
            const timestamp = parsedLog!.args.timestamp;
            const leafHash = parsedLog!.args.leafHash;

            await amoyValidator.connect(relayer).registerRoot(leafHash);
            await bridgeToken.mint(
                user1.address,
                user2.address,
                bridgeAmount,
                nonce,
                timestamp,
                lockReceipt!.hash,
                [],
                leafHash
            );
        });

        it('Should complete full reverse bridge flow from amoy to Sepolia', async function () {
            const burnAmount = ethers.parseEther('2.0');
            const recipient = user1.address;

            const initialBalance = await ethers.provider.getBalance(recipient);

            // Step 1: User burns tokens on amoy
            const burnTx = await bridgeToken.connect(user2).burnForBridge(burnAmount, recipient);
            const burnReceipt = await burnTx.wait();

            // Extract burn event data
            const iface = bridgeToken.interface;
            const burnEvent = burnReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'TokensBurned'
            );
            const parsedLog = iface.parseLog({
                topics: [...burnEvent!.topics],
                data: burnEvent!.data,
            });

            const nonce = parsedLog!.args.nonce;
            const timestamp = parsedLog!.args.timestamp;
            const leafHash = parsedLog!.args.leafHash;

            // Verify tokens were burned
            expect(await bridgeToken.balanceOf(user2.address)).to.equal(
                ethers.parseEther('3.0')
            );

            // Step 2: Relayer registers root on Sepolia
            const merkleRoot = leafHash;
            await sepoliaValidator.connect(relayer).registerRoot(merkleRoot);

            // Step 3: Relayer submits unlock transaction on Sepolia
            await bridgeVault.unlock(
                user2.address,
                recipient,
                burnAmount,
                nonce,
                timestamp,
                [],
                merkleRoot
            );

            // Verify ETH was unlocked
            const finalBalance = await ethers.provider.getBalance(recipient);
            expect(finalBalance).to.equal(initialBalance + burnAmount);

            // Verify vault stats
            const vaultStats = await bridgeVault.getStats();
            expect(vaultStats[1]).to.equal(burnAmount); // totalUnlocked
        });
    });

    describe('Round Trip: Sepolia → amoy → Sepolia', function () {
        it('Should complete full round trip', async function () {
            const initialAmount = ethers.parseEther('3.0');
            const returnAmount = ethers.parseEther('1.5');

            // Forward: Sepolia → amoy
            const lockTx = await bridgeVault.connect(user1).lock(user2.address, {
                value: initialAmount,
            });
            const lockReceipt = await lockTx.wait();

            let iface = bridgeVault.interface;
            let lockEvent = lockReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'BridgingInitiated'
            );
            let parsedLog = iface.parseLog({
                topics: [...lockEvent!.topics],
                data: lockEvent!.data,
            });

            await amoyValidator.connect(relayer).registerRoot(parsedLog!.args.leafHash);
            await bridgeToken.mint(
                user1.address,
                user2.address,
                initialAmount,
                parsedLog!.args.nonce,
                parsedLog!.args.timestamp,
                lockReceipt!.hash,
                [],
                parsedLog!.args.leafHash
            );

            // Verify amoy balance
            expect(await bridgeToken.balanceOf(user2.address)).to.equal(initialAmount);

            // Reverse: amoy → Sepolia
            const initialEthBalance = await ethers.provider.getBalance(user1.address);

            const burnTx = await bridgeToken.connect(user2).burnForBridge(returnAmount, user1.address);
            const burnReceipt = await burnTx.wait();

            iface = bridgeToken.interface;
            const burnEvent = burnReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'TokensBurned'
            );
            parsedLog = iface.parseLog({
                topics: [...burnEvent!.topics],
                data: burnEvent!.data,
            });

            await sepoliaValidator.connect(relayer).registerRoot(parsedLog!.args.leafHash);
            await bridgeVault.unlock(
                user2.address,
                user1.address,
                returnAmount,
                parsedLog!.args.nonce,
                parsedLog!.args.timestamp,
                [],
                parsedLog!.args.leafHash
            );

            // Verify final balances
            expect(await bridgeToken.balanceOf(user2.address)).to.equal(
                initialAmount - returnAmount
            );

            const finalEthBalance = await ethers.provider.getBalance(user1.address);
            expect(finalEthBalance).to.equal(initialEthBalance + returnAmount);
        });
    });

    describe('Security: Replay Attack Prevention', function () {
        it('Should prevent nonce reuse', async function () {
            const amount = ethers.parseEther('1.0');

            const lockTx = await bridgeVault.connect(user1).lock(user2.address, {
                value: amount,
            });
            const lockReceipt = await lockTx.wait();

            const iface = bridgeVault.interface;
            const lockEvent = lockReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'BridgingInitiated'
            );
            const parsedLog = iface.parseLog({
                topics: [...lockEvent!.topics],
                data: lockEvent!.data,
            });

            const nonce = parsedLog!.args.nonce;
            const timestamp = parsedLog!.args.timestamp;
            const leafHash = parsedLog!.args.leafHash;

            await amoyValidator.connect(relayer).registerRoot(leafHash);

            // First mint succeeds
            await bridgeToken.mint(
                user1.address,
                user2.address,
                amount,
                nonce,
                timestamp,
                lockReceipt!.hash,
                [],
                leafHash
            );

            // Second mint with same nonce should fail
            await expect(
                bridgeToken.mint(
                    user1.address,
                    user2.address,
                    amount,
                    nonce,
                    timestamp,
                    lockReceipt!.hash,
                    [],
                    leafHash
                )
            ).to.be.reverted;
        });
    });

    describe('Emergency: Pause Functionality', function () {
        it('Should pause all bridge operations', async function () {
            const amount = ethers.parseEther('1.0');

            // Pause all contracts
            await bridgeVault.pause();
            await bridgeToken.pause();

            // Lock should fail
            await expect(
                bridgeVault.connect(user1).lock(user2.address, { value: amount })
            ).to.be.revertedWithCustomError(bridgeVault, 'EnforcedPause');

            // Burn should fail (after minting some tokens first)
            await bridgeVault.unpause();
            const lockTx = await bridgeVault.connect(user1).lock(user2.address, {
                value: amount,
            });
            const lockReceipt = await lockTx.wait();

            const iface = bridgeVault.interface;
            const lockEvent = lockReceipt?.logs.find(
                (log: any) => log.fragment?.name === 'BridgingInitiated'
            );
            const parsedLog = iface.parseLog({
                topics: [...lockEvent!.topics],
                data: lockEvent!.data,
            });

            await amoyValidator.connect(relayer).registerRoot(parsedLog!.args.leafHash);
            await bridgeToken.unpause();
            await bridgeToken.mint(
                user1.address,
                user2.address,
                amount,
                parsedLog!.args.nonce,
                parsedLog!.args.timestamp,
                lockReceipt!.hash,
                [],
                parsedLog!.args.leafHash
            );

            await bridgeToken.pause();
            await expect(
                bridgeToken.connect(user2).burnForBridge(amount, user1.address)
            ).to.be.revertedWithCustomError(bridgeToken, 'EnforcedPause');
        });
    });
});

