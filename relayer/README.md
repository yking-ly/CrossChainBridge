# Cross-Chain Bridge Relayer

The relayer service is responsible for monitoring bridge events on both Ethereum Sepolia and Polygon Mumbai testnets, generating Merkle proofs, and submitting cross-chain transactions.

## Overview

The relayer acts as the off-chain component that:
1. **Listens** for `BridgingInitiated` events on Sepolia
2. **Listens** for `TokensBurned` events on Mumbai
3. **Generates** Merkle proofs for transactions
4. **Registers** Merkle roots on destination chains
5. **Submits** mint/unlock transactions to complete the bridge

## Prerequisites

- Node.js v18 or higher
- npm or yarn
- Deployed bridge contracts on Sepolia and Mumbai
- Relayer wallet with testnet tokens (ETH on Sepolia, MATIC on Mumbai)

## Installation

```bash
cd relayer
npm install
```

## Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your .env file:**

   ```env
   # Network RPC URLs (Get from Alchemy, Infura, or QuickNode)
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY

   # Relayer Private Key (Create a new wallet for the relayer)
   RELAYER_PRIVATE_KEY=0x...

   # Contract Addresses (From deployment output)
   SEPOLIA_BRIDGE_VAULT=0x...
   SEPOLIA_BRIDGE_VALIDATOR=0x...
   MUMBAI_BRIDGE_TOKEN=0x...
   MUMBAI_BRIDGE_VALIDATOR=0x...

   # Optional Configuration
   RELAYER_PORT=3001
   LOG_LEVEL=info
   DATABASE_URL=./relayer.db
   ```

3. **Fund your relayer wallet:**
   
   The relayer needs gas tokens on both chains:
   - **Sepolia**: ~0.05 ETH (for registering roots and submitting unlock transactions)
   - **Mumbai**: ~0.5 MATIC (for registering roots and submitting mint transactions)

   Get testnet tokens from faucets:
   - Sepolia: https://sepoliafaucet.com
   - Mumbai: https://faucet.polygon.technology

   Or use the funding script from the root directory:
   ```bash
   cd ..
   npx hardhat run scripts/fund-relayer.ts --network sepolia
   npx hardhat run scripts/fund-relayer.ts --network mumbai
   ```

## Running the Relayer

### Development Mode

```bash
npm run dev
```

This starts the relayer with auto-reload on file changes.

### Production Mode

```bash
# Build TypeScript
npm run build

# Start the relayer
npm start
```

## API Endpoints

The relayer exposes a REST API on port 3001 (configurable):

### Health Check
```
GET /health
```

Returns the relayer's health status.

### Get Status
```
GET /status
```

Returns detailed status including:
- Event listener status
- Database statistics
- Contract addresses

### Get Transaction
```
GET /transaction/:txHash
```

Returns details of a specific bridge transaction.

### Get Pending Transactions
```
GET /transactions/pending
```

Returns all pending transactions.

### Get Statistics
```
GET /stats
```

Returns bridge statistics (total transactions, pending, completed, failed).

## WebSocket

The relayer provides real-time updates via WebSocket on the same port:

```javascript
const socket = io('http://localhost:3001');

socket.on('stats', (data) => {
  console.log('Bridge stats:', data);
});
```

## Database

The relayer uses SQLite for development (easily switchable to PostgreSQL for production).

Database file: `relayer.db`

Tables:
- `bridge_transactions`: Stores all bridge transactions
- `merkle_roots`: Stores registered Merkle roots

## Logs

Logs are stored in the `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

## Monitoring

### Check Relayer Status

```bash
curl http://localhost:3001/status
```

### Check Statistics

```bash
curl http://localhost:3001/stats
```

### View Logs

```bash
# Follow combined logs
tail -f logs/combined.log

# Follow error logs
tail -f logs/error.log
```

## Troubleshooting

### Relayer won't start

1. **Check environment variables:**
   ```bash
   cat .env
   ```
   Ensure all required variables are set.

2. **Check RPC connectivity:**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     $SEPOLIA_RPC_URL
   ```

3. **Check relayer balance:**
   ```bash
   cd ..
   npx hardhat run scripts/check-balances.ts --network sepolia
   npx hardhat run scripts/check-balances.ts --network mumbai
   ```

### Transactions not processing

1. **Check if contracts are paused:**
   ```bash
   cd ..
   npx hardhat run scripts/check-balances.ts --network sepolia
   ```

2. **Check relayer logs:**
   ```bash
   tail -f logs/error.log
   ```

3. **Check database:**
   ```bash
   sqlite3 relayer.db "SELECT * FROM bridge_transactions WHERE status='failed';"
   ```

### Low balance warnings

Fund your relayer wallet:
```bash
cd ..
npx hardhat run scripts/fund-relayer.ts --network sepolia
npx hardhat run scripts/fund-relayer.ts --network mumbai
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RELAYER SERVICE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Event      │  │    Proof     │  │ Transaction  │ │
│  │  Listener    │─▶│  Generator   │─▶│  Submitter   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                                      │        │
│         ▼                                      ▼        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              SQLite Database                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         HTTP API + WebSocket Server              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Private Key Security:**
   - Never commit `.env` file
   - Use a dedicated wallet for the relayer
   - Keep minimal funds in the relayer wallet

2. **RPC Endpoints:**
   - Use reputable RPC providers (Alchemy, Infura, QuickNode)
   - Consider using multiple RPC endpoints for redundancy

3. **Monitoring:**
   - Set up alerts for low balance
   - Monitor failed transactions
   - Track gas prices

## Production Deployment

For production deployment:

1. **Use PostgreSQL instead of SQLite:**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/bridge
   ```

2. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name bridge-relayer
   pm2 save
   pm2 startup
   ```

3. **Set up monitoring:**
   - Use PM2 monitoring or similar
   - Set up log rotation
   - Configure alerts

4. **Use environment-specific configs:**
   - Separate `.env` files for staging/production
   - Use secret management (AWS Secrets Manager, HashiCorp Vault)

## Support

For issues or questions:
- Check the main README.md
- Review the ARCHITECTURE.md documentation
- Check the logs in `logs/` directory
