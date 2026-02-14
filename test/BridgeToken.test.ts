import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BridgeToken, BridgeValidator } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('BridgeToken', function () {
    let bridgeToken: BridgeToken;
    let validator: BridgeValidator;
    let owner: SignerWithAddress;
    let relayer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const SOURCE_CHAIN_ID = 11155111; // Sepolia
    const DEST_CHAIN_ID = 80002; // amoy

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();

        // Deploy BridgeValidator
        const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
        validator = await BridgeValidator.deploy(relayer.address);
        await validator.waitForDeployment();

        // Deploy BridgeToken
        const BridgeToken = await ethers.getContractFactory('BridgeToken');
        bridgeToken = await BridgeToken.deploy(
            await validator.getAddress(),
            SOURCE_CHAIN_ID
        );
        await bridgeToken.waitForDeployment();
    });

    describe('Deployment', function () {
        it('Should set the correct name and symbol', async function () {
            expect(await bridgeToken.name()).to.equal('Wrapped Sepolia ETH');
            expect(await bridgeToken.symbol()).to.equal('wSepETH');
            expect(await bridgeToken.decimals()).to.equal(18);
        });

        it('Should set the correct validator', async function () {
            expect(await bridgeToken.validator()).to.equal(await validator.getAddress());
        });

        it('Should set the correct source chain ID', async function () {
            expect(await bridgeToken.sourceChainId()).to.equal(SOURCE_CHAIN_ID);
        });

        it('Should set the correct destination chain ID', async function () {
            expect(await bridgeToken.destinationChainId()).to.equal(DEST_CHAIN_ID);
        });

        it('Should set the deployer as owner', async function () {
            expect(await bridgeToken.owner()).to.equal(owner.address);
        });

        it('Should start with zero total supply', async function () {
            expect(await bridgeToken.totalSupply()).to.equal(0);
        });
    });

    describe('Minting', function () {
        let merkleRoot: string;
        let proof: string[];
        let leafHash: string;

        beforeEach(async function () {
            // Generate a simple Merkle proof (single leaf tree)
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            // Generate leaf hash
            leafHash = ethers.keccak256(
                ethers.concat([
                    ethers.zeroPadValue(sender, 20),
                    ethers.zeroPadValue(recipient, 20),
                    ethers.zeroPadValue(ethers.toBeHex(amount), 32),
                    ethers.zeroPadValue(ethers.toBeHex(nonce), 32),
                    ethers.zeroPadValue(ethers.toBeHex(SOURCE_CHAIN_ID), 32),
                    ethers.zeroPadValue(ethers.toBeHex(DEST_CHAIN_ID), 32),
                    ethers.zeroPadValue(ethers.toBeHex(timestamp), 32),
                ])
            );

            merkleRoot = leafHash; // Single leaf tree
            proof = []; // No proof needed for single leaf

            // Register root with validator
            await validator.connect(relayer).registerRoot(merkleRoot);
        });

        it('Should mint tokens with valid proof', async function () {
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            await expect(
                bridgeToken.mint(
                    user1.address,
                    user2.address,
                    amount,
                    nonce,
                    timestamp,
                    sourceChainTxHash,
                    proof,
                    merkleRoot
                )
            )
                .to.emit(bridgeToken, 'TokensMinted')
                .withArgs(user2.address, amount, nonce, sourceChainTxHash, timestamp);

            expect(await bridgeToken.balanceOf(user2.address)).to.equal(amount);
            expect(await bridgeToken.totalSupply()).to.equal(amount);
        });

        it('Should update stats after minting', async function () {
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            await bridgeToken.mint(
                user1.address,
                user2.address,
                amount,
                nonce,
                timestamp,
                sourceChainTxHash,
                proof,
                merkleRoot
            );

            const stats = await bridgeToken.getStats();
            expect(stats[0]).to.equal(amount); // totalMinted
            expect(stats[1]).to.equal(0); // totalBurned
            expect(stats[2]).to.equal(amount); // totalSupply
            expect(stats[3]).to.equal(1); // mintTransactions
            expect(stats[4]).to.equal(0); // burnTransactions
        });

        it('Should revert if amount is zero', async function () {
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            await expect(
                bridgeToken.mint(
                    user1.address,
                    user2.address,
                    0,
                    nonce,
                    timestamp,
                    sourceChainTxHash,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(bridgeToken, 'InvalidAmount');
        });

        it('Should revert if recipient is zero address', async function () {
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            await expect(
                bridgeToken.mint(
                    user1.address,
                    ethers.ZeroAddress,
                    amount,
                    nonce,
                    timestamp,
                    sourceChainTxHash,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(bridgeToken, 'InvalidRecipient');
        });
    });

    describe('Burning', function () {
        beforeEach(async function () {
            // Mint some tokens first
            const amount = ethers.parseEther('10.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));

            const leafHash = ethers.keccak256(
                ethers.concat([
                    ethers.zeroPadValue(user1.address, 20),
                    ethers.zeroPadValue(user2.address, 20),
                    ethers.zeroPadValue(ethers.toBeHex(amount), 32),
                    ethers.zeroPadValue(ethers.toBeHex(nonce), 32),
                    ethers.zeroPadValue(ethers.toBeHex(SOURCE_CHAIN_ID), 32),
                    ethers.zeroPadValue(ethers.toBeHex(DEST_CHAIN_ID), 32),
                    ethers.zeroPadValue(ethers.toBeHex(timestamp), 32),
                ])
            );

            await validator.connect(relayer).registerRoot(leafHash);

            await bridgeToken.mint(
                user1.address,
                user2.address,
                amount,
                nonce,
                timestamp,
                sourceChainTxHash,
                [],
                leafHash
            );
        });

        it('Should burn tokens successfully', async function () {
            const burnAmount = ethers.parseEther('5.0');
            const initialBalance = await bridgeToken.balanceOf(user2.address);

            await expect(bridgeToken.connect(user2).burnForBridge(burnAmount, user1.address))
                .to.emit(bridgeToken, 'TokensBurned');

            expect(await bridgeToken.balanceOf(user2.address)).to.equal(
                initialBalance - burnAmount
            );
        });

        it('Should update stats after burning', async function () {
            const burnAmount = ethers.parseEther('3.0');

            await bridgeToken.connect(user2).burnForBridge(burnAmount, user1.address);

            const stats = await bridgeToken.getStats();
            expect(stats[1]).to.equal(burnAmount); // totalBurned
            expect(stats[4]).to.equal(1); // burnTransactions
        });

        it('Should revert if burning more than balance', async function () {
            const burnAmount = ethers.parseEther('100.0');

            await expect(
                bridgeToken.connect(user2).burnForBridge(burnAmount, user1.address)
            ).to.be.reverted;
        });

        it('Should revert if amount is zero', async function () {
            await expect(
                bridgeToken.connect(user2).burnForBridge(0, user1.address)
            ).to.be.revertedWithCustomError(bridgeToken, 'InvalidAmount');
        });

        it('Should revert if recipient is zero address', async function () {
            const burnAmount = ethers.parseEther('1.0');

            await expect(
                bridgeToken.connect(user2).burnForBridge(burnAmount, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(bridgeToken, 'InvalidRecipient');
        });
    });

    describe('Pausable', function () {
        it('Should pause and unpause', async function () {
            await bridgeToken.pause();
            expect(await bridgeToken.paused()).to.be.true;

            await bridgeToken.unpause();
            expect(await bridgeToken.paused()).to.be.false;
        });

        it('Should prevent minting when paused', async function () {
            await bridgeToken.pause();

            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const sourceChainTxHash = ethers.keccak256(ethers.toUtf8Bytes('tx1'));
            const leafHash = ethers.keccak256(ethers.toUtf8Bytes('leaf'));

            await expect(
                bridgeToken.mint(
                    user1.address,
                    user2.address,
                    amount,
                    nonce,
                    timestamp,
                    sourceChainTxHash,
                    [],
                    leafHash
                )
            ).to.be.revertedWithCustomError(bridgeToken, 'EnforcedPause');
        });

        it('Should only allow owner to pause', async function () {
            await expect(bridgeToken.connect(user1).pause()).to.be.revertedWithCustomError(
                bridgeToken,
                'OwnableUnauthorizedAccount'
            );
        });
    });

    describe('Admin Functions', function () {
        it('Should update validator address', async function () {
            const newValidator = user1.address;
            await bridgeToken.updateValidator(newValidator);
            expect(await bridgeToken.validator()).to.equal(newValidator);
        });

        it('Should only allow owner to update validator', async function () {
            await expect(
                bridgeToken.connect(user1).updateValidator(user2.address)
            ).to.be.revertedWithCustomError(bridgeToken, 'OwnableUnauthorizedAccount');
        });

        it('Should revert if new validator is zero address', async function () {
            await expect(
                bridgeToken.updateValidator(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(bridgeToken, 'InvalidValidator');
        });
    });

    describe('View Functions', function () {
        it('Should return correct balance', async function () {
            expect(await bridgeToken.balanceOf(user1.address)).to.equal(0);
        });

        it('Should return correct total supply', async function () {
            expect(await bridgeToken.totalSupply()).to.equal(0);
        });

        it('Should return correct stats', async function () {
            const stats = await bridgeToken.getStats();
            expect(stats.length).to.equal(6);
            expect(stats[0]).to.equal(0); // totalMinted
            expect(stats[1]).to.equal(0); // totalBurned
            expect(stats[2]).to.equal(0); // totalSupply
            expect(stats[3]).to.equal(0); // mintTransactions
            expect(stats[4]).to.equal(0); // burnTransactions
        });
    });
});

