import { useAccount } from 'wagmi';
import { Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

// Mock data - in production, this would come from the relayer API or subgraph
const mockTransactions = [
    {
        id: '1',
        txHash: '0x1234...5678',
        sourceChain: 'sepolia',
        destChain: 'mumbai',
        amount: '0.5',
        status: 'completed',
        timestamp: Date.now() - 3600000,
        destTxHash: '0xabcd...efgh',
    },
    {
        id: '2',
        txHash: '0x9876...5432',
        sourceChain: 'mumbai',
        destChain: 'sepolia',
        amount: '0.25',
        status: 'processing',
        timestamp: Date.now() - 300000,
        destTxHash: null,
    },
];

export function TransactionHistory() {
    const { address, isConnected } = useAccount();

    if (!isConnected) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <p className="text-gray-400">Connect your wallet to view transaction history</p>
            </div>
        );
    }

    if (mockTransactions.length === 0) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <p className="text-gray-400">No transactions yet</p>
                <p className="text-sm text-gray-500 mt-2">Your bridge transactions will appear here</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>

            <div className="space-y-4">
                {mockTransactions.map((tx) => (
                    <div
                        key={tx.id}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {tx.status === 'completed' && (
                                    <CheckCircle className="text-green-500" size={24} />
                                )}
                                {tx.status === 'processing' && (
                                    <Clock className="text-yellow-500 animate-pulse" size={24} />
                                )}
                                {tx.status === 'failed' && (
                                    <XCircle className="text-red-500" size={24} />
                                )}
                                <div>
                                    <p className="text-white font-semibold">
                                        {tx.amount} ETH
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        {tx.sourceChain === 'sepolia' ? 'Sepolia' : 'Mumbai'} → {tx.destChain === 'mumbai' ? 'Mumbai' : 'Sepolia'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-400">
                                    {new Date(tx.timestamp).toLocaleString()}
                                </p>
                                <p className={`text-sm font-medium ${tx.status === 'completed' ? 'text-green-500' :
                                        tx.status === 'processing' ? 'text-yellow-500' :
                                            'text-red-500'
                                    }`}>
                                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 text-sm">
                            <a
                                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                                Source Tx <ExternalLink size={14} />
                            </a>
                            {tx.destTxHash && (
                                <a
                                    href={`https://mumbai.polygonscan.com/tx/${tx.destTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    Dest Tx <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
