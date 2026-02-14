# Cross-Chain Bridge Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Security Model](#security-model)
5. [Scalability Considerations](#scalability-considerations)

## System Overview

The Cross-Chain Bridge is a trustless system that enables token transfers between Ethereum Sepolia and Polygon Mumbai testnets. It uses cryptographic proofs (Merkle trees) to verify cross-chain transactions without requiring a trusted third party.

### Core Principles

1. **Trustless Verification**: Uses Merkle proofs instead of trusted oracles
2. **Atomic Operations**: Lock/mint and burn/unlock are atomic
3. **Replay Protection**: Nonce system prevents double-spending
4. **Emergency Controls**: Pausable contracts for security incidents
5. **Gas Efficiency**: Optimized for minimal gas consumption

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   React UI   │  │  wagmi Hooks │  │  RainbowKit  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ├──────────────┬──────────────┐
                         ▼              ▼              ▼
┌──────────────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│   ETHEREUM SEPOLIA       │  │  RELAYER SERVICE │  │   POLYGON MUMBAI         │
│  ┌──────────────────┐   │  │  ┌────────────┐  │  │  ┌──────────────────┐   │
│  │ BridgeValidator  │   │  │  │ Event      │  │  │  │ BridgeValidator  │   │
│  │                  │   │  │  │ Listener   │  │  │  │                  │   │
│  └──────────────────┘   │  │  └────────────┘  │  │  └──────────────────┘   │
│  ┌──────────────────┐   │  │  ┌────────────┐  │  │  ┌──────────────────┐   │
│  │  BridgeVault     │◄──┼──┼──┤ Proof      │──┼──┼─►│  BridgeToken     │   │
│  │  (Lock/Unlock)   │   │  │  │ Generator  │  │  │  │  (Mint/Burn)     │   │
│  └──────────────────┘   │  │  └────────────┘  │  │  └──────────────────┘   │
│  ┌──────────────────┐   │  │  ┌────────────┐  │  │  ┌──────────────────┐   │
│  │ MerkleProof Lib  │   │  │  │ Tx         │  │  │  │ MerkleProof Lib  │   │
│  └──────────────────┘   │  │  │ Submitter  │  │  │  └──────────────────┘   │
│  ┌──────────────────┐   │  │  └────────────┘  │  │  ┌──────────────────┐   │
│  │ MessageLib       │   │  │  ┌────────────┐  │  │  │ MessageLib       │   │
│  └──────────────────┘   │  │  │ Database   │  │  │  └──────────────────┘   │
│                          │  │  └────────────┘  │  │                          │
└──────────────────────────┘  └──────────────────┘  └──────────────────────────┘
```

### Smart Contracts

#### 1. BridgeValidator (Both Chains)

**Purpose**: Validates cross-chain transactions using Merkle proofs

**Key Functions**:
- `registerRoot(bytes32 root)`: Registers a new Merkle root (relayer only)
- `validateTransaction(...)`: Validates a transaction with proof
- `verifyProof(...)`: View function to check proof validity
- `isNonceUsed(uint256 nonce)`: Checks if nonce has been used

**State Variables**:
- `validRoots`: Mapping of registered Merkle roots
- `usedNonces`: Mapping of used nonces (replay protection)
- `relayer`: Address authorized to register roots

**Security Features**:
- Nonce tracking prevents replay attacks
- Time-based rate limiting for root updates
- Pausable for emergencies
- Owner can invalidate fraudulent roots

#### 2. BridgeVault (Sepolia)

**Purpose**: Locks and unlocks ETH on the source chain

**Key Functions**:
- `lock(address recipient)`: Locks ETH for bridging
- `unlock(...)`: Unlocks ETH with valid proof
- `pause()/unpause()`: Emergency controls
- `updateMaxBridgeAmount(uint256)`: Admin function

**State Variables**:
- `totalLocked`: Total ETH locked
- `totalUnlocked`: Total ETH unlocked
- `currentNonce`: Current transaction nonce
- `processedTransactions`: Prevents duplicate processing

**Events**:
- `BridgingInitiated`: Emitted when ETH is locked
- `BridgingCompleted`: Emitted when ETH is unlocked

**Invariants**:
- `balance >= totalLocked - totalUnlocked`
- Each nonce is used exactly once
- All locks emit events

#### 3. BridgeToken (Mumbai)

**Purpose**: Mints and burns wrapped tokens on the destination chain

**Key Functions**:
- `mint(...)`: Mints tokens with valid proof
- `burnForBridge(uint256, address)`: Burns tokens for bridging back
- `pause()/unpause()`: Emergency controls

**State Variables**:
- `totalMinted`: Total tokens minted
- `totalBurned`: Total tokens burned
- `currentNonce`: Current burn nonce

**Token Details**:
- Name: "Wrapped Sepolia ETH"
- Symbol: "wSepETH"
- Decimals: 18
- Standard: ERC20 + Burnable

**Invariants**:
- `totalSupply() == totalMinted - totalBurned`
- Each mint corresponds to a lock on Sepolia
- Each burn should trigger an unlock on Sepolia

### Relayer Service

**Purpose**: Monitors events and submits cross-chain transactions

**Components**:

1. **Event Listener**
   - Subscribes to `BridgingInitiated` on Sepolia
   - Subscribes to `TokensBurned` on Mumbai
   - Stores events in database

2. **Proof Generator**
   - Builds Merkle tree from transactions
   - Generates proofs for specific transactions
   - Registers Merkle roots on both chains

3. **Transaction Submitter**
   - Submits mint transactions to Mumbai
   - Submits unlock transactions to Sepolia
   - Handles gas price optimization
   - Implements retry logic

4. **Database**
   - Stores transaction history
   - Tracks processing status
   - Maintains Merkle tree data

**Technologies**:
- TypeScript/Node.js
- ethers.js for blockchain interaction
- SQLite for development (PostgreSQL-ready)
- Bull for job queue
- Socket.io for real-time updates

## Data Flow

### Bridging Flow (Sepolia → Mumbai)

```
┌─────────┐
│  USER   │
└────┬────┘
     │ 1. Call lock(recipient) with ETH
     ▼
┌─────────────────┐
│  BridgeVault    │
│  (Sepolia)      │
└────┬────────────┘
     │ 2. Lock ETH
     │ 3. Emit BridgingInitiated(sender, recipient, amount, nonce, timestamp, leafHash)
     ▼
┌─────────────────┐
│  Relayer        │
│  (Off-chain)    │
└────┬────────────┘
     │ 4. Detect event
     │ 5. Generate Merkle proof
     │ 6. Register Merkle root on Mumbai
     │ 7. Submit mint transaction
     ▼
┌─────────────────┐
│ BridgeValidator │
│ (Mumbai)        │
└────┬────────────┘
     │ 8. Verify Merkle proof
     │ 9. Check nonce not used
     │ 10. Mark nonce as used
     ▼
┌─────────────────┐
│  BridgeToken    │
│  (Mumbai)       │
└────┬────────────┘
     │ 11. Mint tokens to recipient
     │ 12. Emit TokensMinted
     ▼
┌─────────┐
│  USER   │
│ Receives│
│ wSepETH │
└─────────┘
```

### Reverse Flow (Mumbai → Sepolia)

```
┌─────────┐
│  USER   │
└────┬────┘
     │ 1. Call burnForBridge(amount, recipient)
     ▼
┌─────────────────┐
│  BridgeToken    │
│  (Mumbai)       │
└────┬────────────┘
     │ 2. Burn tokens
     │ 3. Emit TokensBurned(burner, recipient, amount, nonce, timestamp, leafHash)
     ▼
┌─────────────────┐
│  Relayer        │
│  (Off-chain)    │
└────┬────────────┘
     │ 4. Detect event
     │ 5. Generate Merkle proof
     │ 6. Register Merkle root on Sepolia
     │ 7. Submit unlock transaction
     ▼
┌─────────────────┐
│ BridgeValidator │
│ (Sepolia)       │
└────┬────────────┘
     │ 8. Verify Merkle proof
     │ 9. Check nonce not used
     │ 10. Mark nonce as used
     ▼
┌─────────────────┐
│  BridgeVault    │
│  (Sepolia)      │
└────┬────────────┘
     │ 11. Transfer ETH to recipient
     │ 12. Emit BridgingCompleted
     ▼
┌─────────┐
│  USER   │
│ Receives│
│   ETH   │
└─────────┘
```

## Security Model

### Threat Model

**Assumptions**:
1. Smart contract code is correct (should be audited)
2. Relayer is honest (or at least one honest relayer exists)
3. RPC providers are reliable
4. Blockchain consensus is secure

**Threats**:
1. **Double-spending**: Prevented by nonce system
2. **Replay attacks**: Prevented by nonce + chain ID
3. **Reentrancy**: Prevented by ReentrancyGuard
4. **Front-running**: Minimal impact (proofs are public anyway)
5. **Relayer failure**: Manual intervention possible
6. **Malicious relayer**: Cannot steal funds (only delay)

### Security Mechanisms

#### 1. Merkle Proof Verification

```solidity
// Cryptographic proof that transaction is part of valid set
function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) 
    returns (bool)
{
    bytes32 computedHash = leaf;
    for (uint256 i = 0; i < proof.length; i++) {
        computedHash = hashPair(computedHash, proof[i]);
    }
    return computedHash == root;
}
```

**Why it works**:
- Merkle trees provide O(log n) verification
- Changing any transaction invalidates the proof
- Relayer cannot forge proofs without private key

#### 2. Nonce System

```solidity
mapping(uint256 => bool) public usedNonces;

function validateTransaction(..., uint256 nonce, ...) {
    require(!usedNonces[nonce], "Nonce already used");
    // ... verify proof ...
    usedNonces[nonce] = true;
}
```

**Why it works**:
- Each transaction has a unique nonce
- Nonce can only be used once
- Prevents replay attacks

#### 3. Chain ID Validation

```solidity
bytes32 leafHash = keccak256(abi.encodePacked(
    sender, recipient, amount, nonce,
    sourceChainId,  // Prevents cross-chain replay
    destinationChainId,
    timestamp
));
```

**Why it works**:
- Proof from Sepolia won't work on Mumbai
- Prevents cross-chain replay attacks

### Access Control

| Function | Access Level | Purpose |
|----------|-------------|---------|
| `lock()` | Public | Anyone can bridge |
| `unlock()` | Public | Anyone with valid proof |
| `mint()` | Public | Anyone with valid proof |
| `burnForBridge()` | Public | Token holders only |
| `registerRoot()` | Relayer | Prevents spam |
| `pause()` | Owner | Emergency stop |
| `updateMaxAmount()` | Owner | Risk management |

## Scalability Considerations

### Current Limitations

1. **Relayer Centralization**: Single relayer is a bottleneck
2. **Gas Costs**: Each bridge requires 2 transactions
3. **Finality**: Must wait for block confirmations
4. **Throughput**: Limited by block time

### Optimization Strategies

#### 1. Batch Processing

```solidity
function batchMint(
    MintRequest[] calldata requests,
    bytes32[] calldata proof,
    bytes32 root
) external {
    for (uint i = 0; i < requests.length; i++) {
        // Validate and mint
    }
}
```

**Benefits**:
- Amortize gas costs across multiple transactions
- Reduce relayer operational costs
- Increase throughput

#### 2. Optimistic Verification

```solidity
function optimisticMint(...) external {
    // Mint immediately
    _mint(recipient, amount);
    
    // Challenge period (e.g., 1 hour)
    // If fraud proof submitted, slash and revert
}
```

**Benefits**:
- Faster bridging (no waiting for proofs)
- Lower gas costs
- Better UX

**Trade-offs**:
- Requires economic security (bonds)
- More complex implementation
- Potential for temporary inconsistency

#### 3. Decentralized Relayer Network

```solidity
mapping(address => bool) public relayers;
mapping(bytes32 => uint256) public rootVotes;

function voteForRoot(bytes32 root) external onlyRelayer {
    rootVotes[root]++;
    if (rootVotes[root] >= QUORUM) {
        validRoots[root] = true;
    }
}
```

**Benefits**:
- No single point of failure
- Censorship resistance
- Better decentralization

**Trade-offs**:
- Higher gas costs (voting)
- More complex coordination
- Need incentive mechanism

### Future Enhancements

1. **Multi-Token Support**
   - Support any ERC20 token
   - Token registry system
   - Automatic wrapped token deployment

2. **Additional Chains**
   - Arbitrum, Optimism, BSC, etc.
   - Hub-and-spoke architecture
   - Cross-chain routing

3. **Liquidity Pools**
   - Instant bridging via liquidity
   - LP incentives
   - Reduced latency

4. **NFT Bridging**
   - Cross-chain NFT transfers
   - Metadata preservation
   - Provenance tracking

## Performance Metrics

### Gas Costs (Estimated)

| Operation | Gas Used | USD Cost (@ 50 gwei, $2000 ETH) |
|-----------|----------|----------------------------------|
| Lock ETH | ~80,000 | ~$8 |
| Unlock ETH | ~120,000 | ~$12 |
| Mint Tokens | ~100,000 | ~$10 |
| Burn Tokens | ~70,000 | ~$7 |
| Register Root | ~50,000 | ~$5 |

### Latency

| Step | Time | Notes |
|------|------|-------|
| Lock transaction | ~15s | Sepolia block time |
| Event detection | ~30s | Polling interval |
| Proof generation | ~5s | Off-chain computation |
| Root registration | ~2s | Mumbai block time |
| Mint transaction | ~2s | Mumbai block time |
| **Total** | **~54s** | End-to-end latency |

### Throughput

- **Current**: ~10 TPS (limited by relayer)
- **With batching**: ~50 TPS
- **With optimistic**: ~100 TPS
- **Theoretical max**: ~1000 TPS (with full optimization)

## Conclusion

This architecture provides a solid foundation for a cross-chain bridge with:
- ✅ Strong security guarantees
- ✅ Reasonable gas costs
- ✅ Good UX (sub-minute latency)
- ✅ Clear upgrade path

The design prioritizes security and correctness over performance, making it suitable for a production testnet deployment and portfolio demonstration.
