import { useState } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { sepolia, polygonMumbai } from 'wagmi/chains';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';
import { ArrowDown, Loader2, ExternalLink } from 'lucide-react';
import { CONTRACTS } from '../../lib/wagmi';
import { BRIDGE_VAULT_ABI, BRIDGE_TOKEN_ABI } from '../../lib/contracts';
import { formatAmount, validateAmount, getExplorerUrl, getEstimatedTime } from '../../lib/utils';

export function BridgeForm() {
    const { address, chain, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();

    const [amount, setAmount] = useState('');
    const [sourceChain, setSourceChain] = useState<'sepolia' | 'mumbai'>('sepolia');
    const [recipient, setRecipient] = useState('');

    const destChain = sourceChain === 'sepolia' ? 'mumbai' : 'sepolia';
    const sourceChainId = sourceChain === 'sepolia' ? sepolia.id : polygonMumbai.id;
    const destChainId = destChain === 'mumbai' ? polygonMumbai.id : sepolia.id;

    // Get balances
    const { data: sourceBalance } = useBalance({
        address,
        chainId: sourceChainId,
    });

    const { data: destBalance } = useBalance({
        address,
        chainId: destChainId,
    });

    // Bridge transaction
    const { data: hash, writeContract, isPending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Handle bridge
    const handleBridge = async () => {
        if (!isConnected) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!address) return;

        // Validate amount
        const validation = validateAmount(amount);
        if (!validation.valid) {
            toast.error(validation.error || 'Invalid amount');
            return;
        }

        // Check if on correct chain
        if (chain?.id !== sourceChainId) {
            toast.error(`Please switch to ${sourceChain === 'sepolia' ? 'Sepolia' : 'Mumbai'}`);
            switchChain?.({ chainId: sourceChainId });
            return;
        }

        // Use connected address as recipient if not specified
        const recipientAddress = recipient || address;

        try {
            const amountWei = parseEther(amount);

            if (sourceChain === 'sepolia') {
                // Lock on Sepolia
                writeContract({
                    address: CONTRACTS.sepolia.bridgeVault,
                    abi: BRIDGE_VAULT_ABI,
                    functionName: 'lock',
                    args: [recipientAddress as `0x${string}`],
                    value: amountWei,
                });
            } else {
                // Burn on amoy
                writeContract({
                    address: CONTRACTS.amoy.bridgeToken,
                    abi: BRIDGE_TOKEN_ABI,
                    functionName: 'burnForBridge',
                    args: [amountWei, recipientAddress as `0x${string}`],
                });
            }

            toast.success('Transaction submitted!');
        } catch (error: any) {
            console.error('Bridge error:', error);
            toast.error(error.message || 'Failed to bridge');
        }
    };

    // Handle success
    if (isSuccess && hash) {
        const explorerUrl = getExplorerUrl(sourceChainId, hash);
        toast.success(
            <div>
                <p>Bridge initiated successfully!</p>
                <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 mt-1"
                >
                    View on Explorer <ExternalLink size={14} />
                </a>
            </div>,
            { duration: 10000 }
        );
    }

    // Swap source and destination
    const handleSwap = () => {
        setSourceChain(sourceChain === 'sepolia' ? 'mumbai' : 'sepolia');
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
            {/* Source Chain */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    From
                </label>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                        <select
                            value={sourceChain}
                            onChange={(e) => setSourceChain(e.target.value as 'sepolia' | 'mumbai')}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                        >
                            <option value="sepolia">Ethereum Sepolia</option>
                            <option value="mumbai">Polygon Mumbai</option>
                        </select>
                        {sourceBalance && (
                            <span className="text-sm text-gray-400">
                                Balance: {formatAmount(sourceBalance.value)} {sourceBalance.symbol}
                            </span>
                        )}
                    </div>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-transparent text-3xl text-white outline-none"
                        step="0.001"
                        min="0.001"
                    />
                    {sourceBalance && (
                        <button
                            onClick={() => setAmount(formatAmount(sourceBalance.value, 6))}
                            className="text-sm text-blue-400 hover:text-blue-300 mt-2"
                        >
                            Max
                        </button>
                    )}
                </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2 relative z-10">
                <button
                    onClick={handleSwap}
                    className="bg-gray-700 hover:bg-gray-600 border-4 border-gray-800 rounded-full p-2 transition-all"
                >
                    <ArrowDown className="text-white" size={24} />
                </button>
            </div>

            {/* Destination Chain */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    To
                </label>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600">
                            {destChain === 'mumbai' ? 'Polygon Mumbai' : 'Ethereum Sepolia'}
                        </div>
                        {destBalance && (
                            <span className="text-sm text-gray-400">
                                Balance: {formatAmount(destBalance.value)} {destBalance.symbol}
                            </span>
                        )}
                    </div>
                    <div className="text-3xl text-gray-500">
                        {amount || '0.0'}
                    </div>
                </div>
            </div>

            {/* Recipient (Optional) */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    Recipient (optional)
                </label>
                <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={address || '0x...'}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Leave empty to receive at your connected address
                </p>
            </div>

            {/* Info */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Estimated Time</span>
                    <span className="text-white">{getEstimatedTime(sourceChainId)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Network Fee</span>
                    <span className="text-white">~$0.50</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">You Will Receive</span>
                    <span className="text-white">{amount || '0.0'} {destChain === 'mumbai' ? 'wSepETH' : 'ETH'}</span>
                </div>
            </div>

            {/* Bridge Button */}
            <button
                onClick={handleBridge}
                disabled={!isConnected || isPending || isConfirming || !amount}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                {isPending || isConfirming ? (
                    <>
                        <Loader2 className="animate-spin" size={20} />
                        {isPending ? 'Confirm in Wallet...' : 'Processing...'}
                    </>
                ) : !isConnected ? (
                    'Connect Wallet'
                ) : (
                    `Bridge to ${destChain === 'mumbai' ? 'Mumbai' : 'Sepolia'}`
                )}
            </button>

            {/* Warning */}
            <p className="text-xs text-gray-500 text-center mt-4">
                ⚠️ This is a testnet bridge. Do not send mainnet funds.
            </p>
        </div>
    );
}
