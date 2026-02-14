# Cross-Chain Bridge: Ethereum Sepolia ↔ Polygon Amoy

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)

A production-quality, trustless cross-chain bridge enabling seamless token transfers between Ethereum Sepolia and Polygon Amoy testnets. Built with security-first architecture, cryptographic proofs, and modern web3 technologies.

## 🌟 Project Overview

This bridge allows users to:
- **Lock tokens** on Ethereum Sepolia and receive wrapped tokens on Polygon Amoy
- **Burn wrapped tokens** on Amoy to unlock original tokens on Sepolia
- **Track transactions** in real-time with comprehensive status updates
- **Verify transfers** using Merkle proof cryptographic verification

### Why This Project?

This demonstrates:
- ✅ Advanced Solidity smart contract development
- ✅ Cross-chain architecture and cryptographic proofs
- ✅ Modern React/TypeScript frontend with wagmi
- ✅ Backend relayer service implementation
- ✅ Security best practices and testing
- ✅ Production-ready code quality

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│              (React + TypeScript + wagmi + RainbowKit)          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├──────────────┬──────────────┐
                         ▼              ▼              ▼
              ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
              │   Ethereum   │  │   Relayer    │  │   Polygon    │
              │   Sepolia    │  │   Service    │  │   Amoy     │
              │              │  │              │  │              │
              │ BridgeVault  │◄─┤ Event Listen │─►│ BridgeToken  │
              │   (Lock)     │  │ Proof Gen    │  │   (Mint)     │
              │              │  │ Tx Submit    │  │              │
              └──────────────┘  └──────────────┘  └──────────────┘
                     │                                    │
                     └────────── Merkle Proofs ──────────┘
```

### Data Flow

**Sepolia → Amoy (Bridge Out):**
1. User locks ETH in `BridgeVault` on Sepolia
2. Contract emits `BridgingInitiated` event
3. Relayer detects event and generates Merkle proof
4. Relayer submits mint transaction to Amoy
5. `BridgeToken` verifies proof and mints wrapped tokens
6. User receives tokens on Amoy

**Amoy → Sepolia (Bridge Back):**
1. User burns wrapped tokens on Amoy
2. Contract emits `TokensBurned` event
3. Relayer detects event and generates proof
4. Relayer submits unlock transaction to Sepolia
5. `BridgeVault` verifies proof and releases ETH
6. User receives original ETH on Sepolia

## 🛠️ Technology Stack

### Blockchain
- **Smart Contracts:** Solidity 0.8.20+
- **Development Framework:** Hardhat
- **Testing:** Chai, Mocha, Hardhat Network
- **Libraries:** OpenZeppelin Contracts
- **Networks:** Ethereum Sepolia, Polygon Amoy

### Frontend
- **Framework:** React 18 + TypeScript
- **Web3 Integration:** wagmi 2.x + viem
- **Wallet Connection:** RainbowKit
- **Styling:** Tailwind CSS
- **State Management:** React Context + Custom Hooks
- **UI Components:** Custom components with shadcn/ui patterns

### Backend (Relayer)
- **Runtime:** Node.js + TypeScript
- **Blockchain Interaction:** ethers.js v6
- **Database:** SQLite (development) / PostgreSQL (production-ready)
- **Job Queue:** Bull
- **WebSocket:** Socket.io
- **Logging:** Winston

### Infrastructure
- **RPC Provider:** Alchemy (free tier)
- **Block Explorers:** Etherscan, Polygonscan
- **Version Control:** Git
- **Package Manager:** npm

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **MetaMask** browser extension ([Install](https://metamask.io/))
- **Alchemy Account** (free) ([Sign up](https://alchemy.com/))
- **WalletConnect Project ID** (free) ([Get one](https://cloud.walletconnect.com/))

### Windows-Specific Setup

1. **Install Node.js:**
   - Download the Windows installer from nodejs.org
   - Run the installer and follow the prompts
   - Verify installation: `node --version` and `npm --version`

2. **Install Git:**
   - Download Git for Windows from git-scm.com
   - Use default settings during installation
   - Verify: `git --version`

3. **Configure PowerShell (if needed):**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cross-chain-bridge.git
cd cross-chain-bridge
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install relayer dependencies
cd relayer
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# RPC Endpoints (Get from Alchemy - FREE)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
Amoy_RPC_URL=https://polygon-Amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Private Keys (NEVER commit real keys!)
# Create a new wallet for testing - DO NOT use your main wallet
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
RELAYER_PRIVATE_KEY=your_relayer_private_key_here

# Etherscan API Keys (for contract verification - FREE)
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# WalletConnect Project ID (FREE)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses (filled after deployment)
SEPOLIA_BRIDGE_VAULT=
Amoy_BRIDGE_TOKEN=
SEPOLIA_BRIDGE_VALIDATOR=
Amoy_BRIDGE_VALIDATOR=

# Relayer Configuration
RELAYER_PORT=3001
DATABASE_URL=./relayer.db
```

### 4. Get Testnet Tokens

You'll need testnet ETH and MATIC:

**Sepolia ETH:**
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [QuickNode Faucet](https://faucet.quicknode.com/ethereum/sepolia)
- [Infura Faucet](https://www.infura.io/faucet/sepolia)

**Amoy MATIC:**
- [Polygon Faucet](https://faucet.polygon.technology/)
- [Alchemy Amoy Faucet](https://Amoyfaucet.com/)

Fund both your deployer and relayer addresses with testnet tokens.

## 📦 Smart Contract Deployment

### 1. Compile Contracts

```bash
npx hardhat compile
```

### 2. Run Tests

```bash
npx hardhat test
```

Expected output:
```
  BridgeVault
    ✓ Should lock ETH and emit event
    ✓ Should unlock ETH with valid proof
    ✓ Should prevent double-spending
    ✓ Should pause and unpause
    ...

  BridgeToken
    ✓ Should mint tokens with valid proof
    ✓ Should burn tokens
    ✓ Should prevent unauthorized minting
    ...

  Integration Tests
    ✓ Should complete full bridge flow
    ✓ Should handle reverse bridging
    ...

  50 passing (5s)
```

### 3. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

Save the deployed contract addresses!

### 4. Deploy to Amoy

```bash
npx hardhat run scripts/deploy-Amoy.ts --network Amoy
```

### 5. Verify Contracts

```bash
# Verify on Etherscan (Sepolia)
npx hardhat verify --network sepolia <BRIDGE_VAULT_ADDRESS>

# Verify on Polygonscan (Amoy)
npx hardhat verify --network Amoy <BRIDGE_TOKEN_ADDRESS>
```

### 6. Update Environment Variables

Add the deployed contract addresses to your `.env` file:

```env
SEPOLIA_BRIDGE_VAULT=0x...
Amoy_BRIDGE_TOKEN=0x...
SEPOLIA_BRIDGE_VALIDATOR=0x...
Amoy_BRIDGE_VALIDATOR=0x...
```

## 🔄 Running the Relayer

The relayer is the backbone of the bridge, monitoring events and submitting cross-chain transactions.

### 1. Configure Relayer

```bash
cd relayer
cp .env.example .env
```

### 2. Initialize Database

```bash
npm run db:migrate
```

### 3. Start Relayer

```bash
npm run start
```

Expected output:
```
[INFO] Relayer starting...
[INFO] Connected to Sepolia at block 5234567
[INFO] Connected to Amoy at block 4123456
[INFO] Listening for BridgingInitiated events...
[INFO] Listening for TokensBurned events...
[INFO] Relayer ready ✓
```

Keep this terminal running!

## 🎨 Running the Frontend

### 1. Configure Frontend

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_SEPOLIA_BRIDGE_VAULT=0x...
VITE_Amoy_BRIDGE_TOKEN=0x...
VITE_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_Amoy_RPC=https://polygon-Amoy.g.alchemy.com/v2/YOUR_KEY
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Open in Browser

Navigate to `http://localhost:5173`

You should see the bridge interface!

## 🎯 Using the Bridge

### First-Time Setup

1. **Connect Wallet:**
   - Click "Connect Wallet" button
   - Select MetaMask (or your preferred wallet)
   - Approve the connection

2. **Add Networks to MetaMask:**
   - The app will prompt you to add Sepolia and Amoy
   - Click "Add Network" for each

3. **Get Testnet Tokens:**
   - Use the faucet links provided in the UI
   - Fund your wallet with Sepolia ETH and Amoy MATIC

### Bridging Tokens (Sepolia → Amoy)

1. **Select Source Chain:** Ethereum Sepolia
2. **Select Destination Chain:** Polygon Amoy
3. **Enter Amount:** e.g., 0.1 ETH
4. **Review Details:**
   - Estimated time: ~5-10 minutes
   - Gas fees: Displayed in real-time
5. **Click "Bridge Now"**
6. **Confirm in MetaMask**
7. **Wait for Confirmation:**
   - Transaction submitted ✓
   - Relayer processing...
   - Tokens minted on Amoy ✓

### Bridging Back (Amoy → Sepolia)

1. **Switch to Amoy network**
2. **Select "Bridge Back" mode**
3. **Enter amount of wrapped tokens**
4. **Click "Bridge Back"**
5. **Confirm burn transaction**
6. **Wait for unlock on Sepolia**

### Viewing Transaction History

- Click "History" tab
- See all your bridge transactions
- Filter by status (pending, completed, failed)
- Click transaction for details
- View on block explorer

## 🧪 Testing

### Smart Contract Tests

```bash
# Run all tests
npx hardhat test

# Run with coverage
npx hardhat coverage

# Run specific test file
npx hardhat test test/BridgeVault.test.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Frontend Tests

```bash
cd frontend
npm run test
```

### Integration Tests

```bash
# Full end-to-end bridge flow
npx hardhat test test/integration.test.ts
```

### Manual Testing Checklist

- [ ] Connect wallet successfully
- [ ] Switch between Sepolia and Amoy
- [ ] Bridge 0.01 ETH from Sepolia to Amoy
- [ ] Verify wrapped tokens received on Amoy
- [ ] Bridge back 0.01 tokens from Amoy to Sepolia
- [ ] Verify original ETH received on Sepolia
- [ ] Check transaction history shows all transactions
- [ ] Test with different amounts
- [ ] Test error handling (insufficient balance, etc.)
- [ ] Test pause/unpause functionality (owner only)

## 📊 Project Structure

```
cross-chain-bridge/
├── contracts/                    # Smart contracts
│   ├── BridgeVault.sol          # Sepolia vault (lock/unlock)
│   ├── BridgeToken.sol          # Amoy wrapped token (mint/burn)
│   ├── BridgeValidator.sol      # Proof verification
│   └── libraries/
│       ├── MerkleProof.sol      # Merkle tree verification
│       └── MessageLib.sol       # Message encoding/decoding
│
├── scripts/                      # Deployment scripts
│   ├── deploy-sepolia.ts
│   ├── deploy-Amoy.ts
│   ├── verify-contracts.ts
│   └── helpers/
│
├── test/                         # Smart contract tests
│   ├── BridgeVault.test.ts
│   ├── BridgeToken.test.ts
│   ├── BridgeValidator.test.ts
│   └── integration.test.ts
│
├── relayer/                      # Relayer service
│   ├── src/
│   │   ├── index.ts             # Entry point
│   │   ├── eventListener.ts     # Event monitoring
│   │   ├── proofGenerator.ts    # Merkle proof generation
│   │   ├── transactionSubmitter.ts
│   │   ├── database.ts
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Bridge/
│   │   │   ├── Wallet/
│   │   │   ├── TransactionHistory/
│   │   │   └── Layout/
│   │   ├── hooks/
│   │   │   ├── useBridge.ts
│   │   │   ├── useTransactionHistory.ts
│   │   │   └── useBridgeStats.ts
│   │   ├── lib/
│   │   │   ├── wagmi.ts
│   │   │   ├── contracts.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── API.md
│   └── DEPLOYMENT.md
│
├── hardhat.config.ts
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔒 Security

### Smart Contract Security

- ✅ **OpenZeppelin Contracts:** Using audited, battle-tested libraries
- ✅ **Reentrancy Guards:** Protection against reentrancy attacks
- ✅ **Access Control:** Role-based permissions
- ✅ **Pausable:** Emergency stop mechanism
- ✅ **Nonce System:** Prevents replay attacks
- ✅ **Merkle Proofs:** Cryptographic verification
- ✅ **Input Validation:** All inputs validated
- ✅ **Safe Math:** Overflow protection (Solidity 0.8+)
- ✅ **Events:** All state changes emit events
- ✅ **Comprehensive Tests:** >90% code coverage

### Relayer Security

- ✅ **Private Key Management:** Environment variables only
- ✅ **Rate Limiting:** Prevents spam attacks
- ✅ **Transaction Validation:** Verify before submitting
- ✅ **Error Handling:** Graceful failure recovery
- ✅ **Monitoring:** Logging and alerts

### Frontend Security

- ✅ **No Private Keys:** Never handle private keys
- ✅ **Input Sanitization:** Validate all user inputs
- ✅ **HTTPS Only:** Secure connections
- ✅ **Content Security Policy:** XSS protection

### Known Limitations

⚠️ **Testnet Only:** This is designed for testnets. Mainnet deployment requires:
- Professional security audit
- Multi-signature governance
- Insurance fund
- Formal verification
- Bug bounty program

⚠️ **Centralized Relayer:** Current implementation uses a single relayer. Production should use:
- Decentralized relayer network
- Incentive mechanisms
- Slashing conditions

⚠️ **Trust Assumptions:** Users trust:
- Relayer to submit transactions
- Smart contract code
- RPC providers

See [SECURITY.md](docs/SECURITY.md) for detailed security analysis.

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md):** System design and data flow
- **[Security](docs/SECURITY.md):** Security analysis and best practices
- **[API Reference](docs/API.md):** Contract functions and events
- **[Deployment Guide](docs/DEPLOYMENT.md):** Step-by-step deployment

## 🐛 Troubleshooting

### Common Issues

**Issue:** `Error: insufficient funds for gas`
- **Solution:** Get more testnet tokens from faucets

**Issue:** `Error: network changed`
- **Solution:** Make sure you're on the correct network (Sepolia or Amoy)

**Issue:** Relayer not detecting events
- **Solution:** Check RPC URL is correct and Alchemy key is valid

**Issue:** Transaction stuck in "Pending"
- **Solution:** Check block explorer, may need to wait for confirmations

**Issue:** MetaMask shows wrong network
- **Solution:** Manually switch network in MetaMask

**Issue:** `Error: nonce already used`
- **Solution:** This transaction was already processed (duplicate)

### Getting Help

- Check [Issues](https://github.com/yourusername/cross-chain-bridge/issues)
- Read [Documentation](docs/)
- Review [Test Files](test/) for examples

## 🚀 Future Improvements

### Phase 1 (Current)
- ✅ Basic bridge functionality
- ✅ Merkle proof verification
- ✅ Single relayer
- ✅ ETH bridging

### Phase 2 (Planned)
- [ ] Multi-token support (ERC20)
- [ ] Decentralized relayer network
- [ ] Optimistic verification
- [ ] Fraud proofs
- [ ] Governance system

### Phase 3 (Future)
- [ ] Additional chains (Arbitrum, Optimism)
- [ ] NFT bridging
- [ ] Liquidity pools
- [ ] Fee optimization
- [ ] Mobile app

### Known Limitations

- Single relayer (centralization risk)
- No incentive mechanism for relayers
- Limited to ETH (no ERC20 yet)
- No slashing for malicious relayers
- Testnet only (not production-ready)


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
