import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BridgeValidator } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('BridgeValidator', function () {
    let validator: BridgeValidator;
    let owner: SignerWithAddress;
    let relayer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const SOURCE_CHAIN_ID = 11155111; // Sepolia
    const DEST_CHAIN_ID = 80002; // amoy

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();

        const BridgeValidator = await ethers.getContractFactory('BridgeValidator');
        validator = await BridgeValidator.deploy(relayer.address);
        await validator.waitForDeployment();
    });

    describe('Deployment', function () {
        it('Should set the correct relayer', async function () {
            expect(await validator.relayer()).to.equal(relayer.address);
        });

        it('Should set the deployer as owner', async function () {
            expect(await validator.owner()).to.equal(owner.address);
        });

        it('Should not be paused initially', async function () {
            expect(await validator.paused()).to.be.false;
        });
    });

    describe('Root Registration', function () {
        it('Should allow relayer to register root', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));

            await expect(validator.connect(relayer).registerRoot(root))
                .to.emit(validator, 'RootRegistered')
                .withArgs(root, relayer.address);

            expect(await validator.validRoots(root)).to.be.true;
        });

        it('Should prevent non-relayer from registering root', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));

            await expect(
                validator.connect(user1).registerRoot(root)
            ).to.be.revertedWithCustomError(validator, 'UnauthorizedRelayer');
        });

        it('Should prevent registering zero root', async function () {
            await expect(
                validator.connect(relayer).registerRoot(ethers.ZeroHash)
            ).to.be.revertedWithCustomError(validator, 'InvalidRoot');
        });

        it('Should prevent registering duplicate root', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));

            await validator.connect(relayer).registerRoot(root);

            await expect(
                validator.connect(relayer).registerRoot(root)
            ).to.be.revertedWithCustomError(validator, 'RootAlreadyRegistered');
        });
    });

    describe('Transaction Validation', function () {
        let merkleRoot: string;
        let leafHash: string;

        beforeEach(async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);

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
            await validator.connect(relayer).registerRoot(merkleRoot);
        });

        it('Should validate transaction with correct proof', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const proof: string[] = []; // Empty proof for single leaf

            await expect(
                validator.validateTransaction(
                    sender,
                    recipient,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    merkleRoot
                )
            )
                .to.emit(validator, 'TransactionValidated')
                .withArgs(nonce, merkleRoot);

            expect(await validator.isNonceUsed(nonce)).to.be.true;
        });

        it('Should reject invalid root', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const invalidRoot = ethers.keccak256(ethers.toUtf8Bytes('invalid'));
            const proof: string[] = [];

            await expect(
                validator.validateTransaction(
                    sender,
                    recipient,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    invalidRoot
                )
            ).to.be.revertedWithCustomError(validator, 'InvalidRoot');
        });

        it('Should reject used nonce', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const proof: string[] = [];

            // First validation
            await validator.validateTransaction(
                sender,
                recipient,
                amount,
                nonce,
                SOURCE_CHAIN_ID,
                DEST_CHAIN_ID,
                timestamp,
                proof,
                merkleRoot
            );

            // Try to use same nonce again
            await expect(
                validator.validateTransaction(
                    sender,
                    recipient,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(validator, 'NonceAlreadyUsed');
        });

        it('Should reject zero amount', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const proof: string[] = [];

            await expect(
                validator.validateTransaction(
                    sender,
                    recipient,
                    0,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(validator, 'InvalidAmount');
        });

        it('Should reject zero address sender', async function () {
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const proof: string[] = [];

            await expect(
                validator.validateTransaction(
                    ethers.ZeroAddress,
                    recipient,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(validator, 'InvalidAddress');
        });

        it('Should reject zero address recipient', async function () {
            const sender = user1.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const proof: string[] = [];

            await expect(
                validator.validateTransaction(
                    sender,
                    ethers.ZeroAddress,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    merkleRoot
                )
            ).to.be.revertedWithCustomError(validator, 'InvalidAddress');
        });
    });

    describe('Proof Verification', function () {
        it('Should verify valid proof (view function)', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);

            const leafHash = ethers.keccak256(
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

            const merkleRoot = leafHash;
            const proof: string[] = [];

            await validator.connect(relayer).registerRoot(merkleRoot);

            const isValid = await validator.verifyProof(
                sender,
                recipient,
                amount,
                nonce,
                SOURCE_CHAIN_ID,
                DEST_CHAIN_ID,
                timestamp,
                proof,
                merkleRoot
            );

            expect(isValid).to.be.true;
        });

        it('Should reject invalid proof (view function)', async function () {
            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const invalidRoot = ethers.keccak256(ethers.toUtf8Bytes('invalid'));
            const proof: string[] = [];

            await validator.connect(relayer).registerRoot(invalidRoot);

            const isValid = await validator.verifyProof(
                sender,
                recipient,
                amount,
                nonce,
                SOURCE_CHAIN_ID,
                DEST_CHAIN_ID,
                timestamp,
                proof,
                ethers.keccak256(ethers.toUtf8Bytes('different'))
            );

            expect(isValid).to.be.false;
        });
    });

    describe('Root Invalidation', function () {
        it('Should allow owner to invalidate root', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));
            await validator.connect(relayer).registerRoot(root);

            await expect(validator.invalidateRoot(root))
                .to.emit(validator, 'RootInvalidated')
                .withArgs(root, owner.address);

            expect(await validator.validRoots(root)).to.be.false;
        });

        it('Should prevent non-owner from invalidating root', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));
            await validator.connect(relayer).registerRoot(root);

            await expect(
                validator.connect(user1).invalidateRoot(root)
            ).to.be.revertedWithCustomError(validator, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Relayer Management', function () {
        it('Should allow owner to update relayer', async function () {
            const newRelayer = user1.address;

            await expect(validator.updateRelayer(newRelayer))
                .to.emit(validator, 'RelayerUpdated')
                .withArgs(relayer.address, newRelayer);

            expect(await validator.relayer()).to.equal(newRelayer);
        });

        it('Should prevent non-owner from updating relayer', async function () {
            await expect(
                validator.connect(user1).updateRelayer(user2.address)
            ).to.be.revertedWithCustomError(validator, 'OwnableUnauthorizedAccount');
        });

        it('Should reject zero address relayer', async function () {
            await expect(
                validator.updateRelayer(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(validator, 'InvalidRelayer');
        });
    });

    describe('Pausable', function () {
        it('Should pause and unpause', async function () {
            await validator.pause();
            expect(await validator.paused()).to.be.true;

            await validator.unpause();
            expect(await validator.paused()).to.be.false;
        });

        it('Should prevent validation when paused', async function () {
            await validator.pause();

            const sender = user1.address;
            const recipient = user2.address;
            const amount = ethers.parseEther('1.0');
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
            const proof: string[] = [];

            await expect(
                validator.validateTransaction(
                    sender,
                    recipient,
                    amount,
                    nonce,
                    SOURCE_CHAIN_ID,
                    DEST_CHAIN_ID,
                    timestamp,
                    proof,
                    root
                )
            ).to.be.revertedWithCustomError(validator, 'EnforcedPause');
        });

        it('Should only allow owner to pause', async function () {
            await expect(validator.connect(user1).pause()).to.be.revertedWithCustomError(
                validator,
                'OwnableUnauthorizedAccount'
            );
        });
    });

    describe('View Functions', function () {
        it('Should check if nonce is used', async function () {
            expect(await validator.isNonceUsed(1)).to.be.false;
        });

        it('Should check if root is valid', async function () {
            const root = ethers.keccak256(ethers.toUtf8Bytes('test-root'));
            expect(await validator.validRoots(root)).to.be.false;

            await validator.connect(relayer).registerRoot(root);
            expect(await validator.validRoots(root)).to.be.true;
        });
    });
});

