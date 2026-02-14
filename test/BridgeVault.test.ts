import { expect } from "chai";
import { ethers } from "hardhat";
import { BridgeVault, BridgeValidator } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BridgeVault", function () {
    let vault: BridgeVault;
    let validator: BridgeValidator;
    let owner: SignerWithAddress;
    let relayer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const SOURCE_CHAIN_ID = 11155111; // Sepolia
    const DEST_CHAIN_ID = 80002; // amoy
    const MIN_AMOUNT = ethers.parseEther("0.001");
    const BRIDGE_AMOUNT = ethers.parseEther("1");

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();

        // Deploy BridgeValidator
        const BridgeValidator = await ethers.getContractFactory("BridgeValidator");
        validator = await BridgeValidator.deploy(relayer.address);
        await validator.waitForDeployment();

        // Deploy BridgeVault
        const BridgeVault = await ethers.getContractFactory("BridgeVault");
        vault = await BridgeVault.deploy(
            await validator.getAddress(),
            DEST_CHAIN_ID
        );
        await vault.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct validator", async function () {
            expect(await vault.validator()).to.equal(await validator.getAddress());
        });

        it("Should set the correct chain IDs", async function () {
            expect(await vault.sourceChainId()).to.equal(SOURCE_CHAIN_ID);
            expect(await vault.destinationChainId()).to.equal(DEST_CHAIN_ID);
        });

        it("Should set the correct owner", async function () {
            expect(await vault.owner()).to.equal(owner.address);
        });

        it("Should start with nonce 1", async function () {
            expect(await vault.currentNonce()).to.equal(1);
        });

        it("Should start with zero locked amount", async function () {
            expect(await vault.totalLocked()).to.equal(0);
        });
    });

    describe("Locking ETH", function () {
        it("Should lock ETH and emit BridgingInitiated event", async function () {
            const tx = await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            await expect(tx)
                .to.emit(vault, "BridgingInitiated")
                .withArgs(
                    user1.address,
                    user2.address,
                    BRIDGE_AMOUNT,
                    1, // nonce
                    await time.latest(),
                    (leafHash: any) => leafHash !== ethers.ZeroHash
                );
        });

        it("Should increment nonce after locking", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.currentNonce()).to.equal(2);
        });

        it("Should update total locked amount", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.totalLocked()).to.equal(BRIDGE_AMOUNT);
        });

        it("Should update vault balance", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(
                BRIDGE_AMOUNT
            );
        });

        it("Should increment total bridge transactions", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.totalBridgeTransactions()).to.equal(1);
        });

        it("Should revert if amount is below minimum", async function () {
            await expect(
                vault.connect(user1).lock(user2.address, {
                    value: ethers.parseEther("0.0001"),
                })
            ).to.be.revertedWithCustomError(vault, "InsufficientAmount");
        });

        it("Should revert if amount exceeds maximum", async function () {
            const maxAmount = await vault.maxBridgeAmount();
            await expect(
                vault.connect(user1).lock(user2.address, {
                    value: maxAmount + 1n,
                })
            ).to.be.revertedWithCustomError(vault, "ExceedsMaximum");
        });

        it("Should revert if recipient is zero address", async function () {
            await expect(
                vault.connect(user1).lock(ethers.ZeroAddress, {
                    value: BRIDGE_AMOUNT,
                })
            ).to.be.revertedWithCustomError(vault, "InvalidRecipient");
        });

        it("Should allow multiple locks from same user", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.totalLocked()).to.equal(BRIDGE_AMOUNT * 2n);
            expect(await vault.currentNonce()).to.equal(3);
        });

        it("Should allow locks from different users", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            await vault.connect(user2).lock(user1.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.totalBridgeTransactions()).to.equal(2);
        });
    });

    describe("Unlocking ETH", function () {
        let leafHash: string;
        let proof: string[];
        let root: string;

        beforeEach(async function () {
            // For testing, we'll create a simple proof
            // In production, this would come from the relayer
            const timestamp = await time.latest();

            // Generate leaf hash
            leafHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
                    [user1.address, user2.address, BRIDGE_AMOUNT, 1, DEST_CHAIN_ID, SOURCE_CHAIN_ID, timestamp]
                )
            );

            // Create a simple Merkle tree with one leaf
            root = leafHash;
            proof = [];

            // Register root with validator
            await validator.connect(relayer).registerRoot(root);
        });

        it("Should unlock ETH with valid proof", async function () {
            // Fund the vault first
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            const timestamp = await time.latest();
            const initialBalance = await ethers.provider.getBalance(user2.address);

            await vault.unlock(
                user1.address,
                user2.address,
                BRIDGE_AMOUNT,
                1,
                timestamp,
                proof,
                root
            );

            const finalBalance = await ethers.provider.getBalance(user2.address);
            expect(finalBalance - initialBalance).to.equal(BRIDGE_AMOUNT);
        });

        it("Should emit BridgingCompleted event", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            const timestamp = await time.latest();

            await expect(
                vault.unlock(
                    user1.address,
                    user2.address,
                    BRIDGE_AMOUNT,
                    1,
                    timestamp,
                    proof,
                    root
                )
            ).to.emit(vault, "BridgingCompleted");
        });

        it("Should update total unlocked amount", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            const timestamp = await time.latest();

            await vault.unlock(
                user1.address,
                user2.address,
                BRIDGE_AMOUNT,
                1,
                timestamp,
                proof,
                root
            );

            expect(await vault.totalUnlocked()).to.equal(BRIDGE_AMOUNT);
        });

        it("Should prevent double-spending with same nonce", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT * 2n,
            });

            const timestamp = await time.latest();

            await vault.unlock(
                user1.address,
                user2.address,
                BRIDGE_AMOUNT,
                1,
                timestamp,
                proof,
                root
            );

            // Try to unlock again with same nonce
            await expect(
                vault.unlock(
                    user1.address,
                    user2.address,
                    BRIDGE_AMOUNT,
                    1,
                    timestamp,
                    proof,
                    root
                )
            ).to.be.reverted; // Will revert because nonce is used
        });

        it("Should revert if recipient is zero address", async function () {
            const timestamp = await time.latest();

            await expect(
                vault.unlock(
                    user1.address,
                    ethers.ZeroAddress,
                    BRIDGE_AMOUNT,
                    1,
                    timestamp,
                    proof,
                    root
                )
            ).to.be.revertedWithCustomError(vault, "InvalidRecipient");
        });

        it("Should revert if amount is zero", async function () {
            const timestamp = await time.latest();

            await expect(
                vault.unlock(
                    user1.address,
                    user2.address,
                    0,
                    1,
                    timestamp,
                    proof,
                    root
                )
            ).to.be.revertedWithCustomError(vault, "InsufficientAmount");
        });
    });

    describe("Pausable", function () {
        it("Should allow owner to pause", async function () {
            await vault.pause();
            expect(await vault.paused()).to.be.true;
        });

        it("Should allow owner to unpause", async function () {
            await vault.pause();
            await vault.unpause();
            expect(await vault.paused()).to.be.false;
        });

        it("Should prevent locking when paused", async function () {
            await vault.pause();

            await expect(
                vault.connect(user1).lock(user2.address, {
                    value: BRIDGE_AMOUNT,
                })
            ).to.be.revertedWithCustomError(vault, "EnforcedPause");
        });

        it("Should prevent unlocking when paused", async function () {
            await vault.pause();
            const timestamp = await time.latest();

            await expect(
                vault.unlock(
                    user1.address,
                    user2.address,
                    BRIDGE_AMOUNT,
                    1,
                    timestamp,
                    [],
                    ethers.ZeroHash
                )
            ).to.be.revertedWithCustomError(vault, "EnforcedPause");
        });

        it("Should prevent non-owner from pausing", async function () {
            await expect(
                vault.connect(user1).pause()
            ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to update max bridge amount", async function () {
            const newMax = ethers.parseEther("20");
            await vault.updateMaxBridgeAmount(newMax);
            expect(await vault.maxBridgeAmount()).to.equal(newMax);
        });

        it("Should emit event when max amount updated", async function () {
            const oldMax = await vault.maxBridgeAmount();
            const newMax = ethers.parseEther("20");

            await expect(vault.updateMaxBridgeAmount(newMax))
                .to.emit(vault, "MaxBridgeAmountUpdated")
                .withArgs(oldMax, newMax);
        });

        it("Should prevent non-owner from updating max amount", async function () {
            await expect(
                vault.connect(user1).updateMaxBridgeAmount(ethers.parseEther("20"))
            ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
        });
    });

    describe("View Functions", function () {
        it("Should return correct balance", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            expect(await vault.getBalance()).to.equal(BRIDGE_AMOUNT);
        });

        it("Should return correct stats", async function () {
            await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            const stats = await vault.getStats();
            expect(stats.locked).to.equal(BRIDGE_AMOUNT);
            expect(stats.unlocked).to.equal(0);
            expect(stats.balance).to.equal(BRIDGE_AMOUNT);
            expect(stats.transactions).to.equal(1);
            expect(stats.nonce).to.equal(2);
        });

        it("Should return correct version", async function () {
            expect(await vault.version()).to.equal("1.0.0");
        });
    });

    describe("Gas Optimization", function () {
        it("Should use reasonable gas for locking", async function () {
            const tx = await vault.connect(user1).lock(user2.address, {
                value: BRIDGE_AMOUNT,
            });

            const receipt = await tx.wait();
            console.log("      Gas used for lock:", receipt?.gasUsed.toString());

            // Should be under 100k gas
            expect(receipt?.gasUsed).to.be.lessThan(100000);
        });
    });
});

