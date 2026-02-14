// Bridge Vault ABI (Sepolia)
export const BRIDGE_VAULT_ABI = [
    {
        inputs: [{ name: 'recipient', type: 'address' }],
        name: 'lock',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getBalance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getStats',
        outputs: [
            { name: 'locked', type: 'uint256' },
            { name: 'unlocked', type: 'uint256' },
            { name: 'balance', type: 'uint256' },
            { name: 'transactions', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'maxBridgeAmount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'sender', type: 'address' },
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: true, name: 'nonce', type: 'uint256' },
            { indexed: false, name: 'timestamp', type: 'uint256' },
            { indexed: false, name: 'leafHash', type: 'bytes32' },
        ],
        name: 'BridgingInitiated',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: true, name: 'nonce', type: 'uint256' },
            { indexed: false, name: 'timestamp', type: 'uint256' },
        ],
        name: 'BridgingCompleted',
        type: 'event',
    },
] as const;

// Bridge Token ABI (Mumbai)
export const BRIDGE_TOKEN_ABI = [
    {
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'recipient', type: 'address' },
        ],
        name: 'burnForBridge',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getStats',
        outputs: [
            { name: 'minted', type: 'uint256' },
            { name: 'burned', type: 'uint256' },
            { name: 'supply', type: 'uint256' },
            { name: 'mintTxs', type: 'uint256' },
            { name: 'burnTxs', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: true, name: 'nonce', type: 'uint256' },
            { indexed: true, name: 'sourceChainTxHash', type: 'bytes32' },
            { indexed: false, name: 'timestamp', type: 'uint256' },
        ],
        name: 'TokensMinted',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'burner', type: 'address' },
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: true, name: 'nonce', type: 'uint256' },
            { indexed: false, name: 'timestamp', type: 'uint256' },
            { indexed: false, name: 'leafHash', type: 'bytes32' },
        ],
        name: 'TokensBurned',
        type: 'event',
    },
] as const;
