import { useReadContract } from 'wagmi';
import { sepolia, polygonMumbai } from 'wagmi/chains';
import { CONTRACTS } from '../../lib/wagmi';
import { BRIDGE_VAULT_ABI, BRIDGE_TOKEN_ABI } from '../../lib/contracts';
import { formatAmount, formatNumber } from '../../lib/utils';
import { TrendingUp, Lock, Coins } from 'lucide-react';

export function Stats() {
    // Get Sepolia vault stats
    const { data: vaultStats } = useReadContract({
        address: CONTRACTS.sepolia.bridgeVault,
        abi: BRIDGE_VAULT_ABI,
        functionName: 'getStats',
        chainId: sepolia.id,
    });

    // Get Mumbai token stats
    const { data: tokenStats } = useReadContract({
        address: CONTRACTS.mumbai.bridgeToken,
        abi: BRIDGE_TOKEN_ABI,
        functionName: 'getStats',
        chainId: polygonMumbai.id,
    });

    const totalLocked = vaultStats ? formatAmount(vaultStats[0]) : '0';
    const totalUnlocked = vaultStats ? formatAmount(vaultStats[1]) : '0';
    const vaultBalance = vaultStats ? formatAmount(vaultStats[2]) : '0';
    const totalTransactions = vaultStats ? Number(vaultStats[3]) : 0;

    const totalMinted = tokenStats ? formatAmount(tokenStats[0]) : '0';
    const totalBurned = tokenStats ? formatAmount(tokenStats[1]) : '0';
    const totalSupply = tokenStats ? formatAmount(tokenStats[2]) : '0';
    const mintTransactions = tokenStats ? Number(tokenStats[3]) : 0;
    const burnTransactions = tokenStats ? Number(tokenStats[4]) : 0;

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Lock size={24} />
                        <TrendingUp size={20} className="text-blue-200" />
                    </div>
                    <p className="text-blue-200 text-sm mb-1">Total Value Locked</p>
                    <p className="text-3xl font-bold">{vaultBalance} ETH</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Coins size={24} />
                        <TrendingUp size={20} className="text-purple-200" />
                    </div>
                    <p className="text-purple-200 text-sm mb-1">Total Transactions</p>
                    <p className="text-3xl font-bold">{formatNumber(totalTransactions + mintTransactions + burnTransactions)}</p>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <TrendingUp size={20} className="text-green-200" />
                    </div>
                    <p className="text-green-200 text-sm mb-1">Wrapped Supply</p>
                    <p className="text-3xl font-bold">{totalSupply} wSepETH</p>
                </div>
            </div>

            {/* Detailed Stats */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Detailed Statistics</h2>

                <div className="space-y-6">
                    {/* Sepolia Stats */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            Ethereum Sepolia
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Total Locked</p>
                                <p className="text-white text-xl font-semibold">{totalLocked} ETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Total Unlocked</p>
                                <p className="text-white text-xl font-semibold">{totalUnlocked} ETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Vault Balance</p>
                                <p className="text-white text-xl font-semibold">{vaultBalance} ETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Transactions</p>
                                <p className="text-white text-xl font-semibold">{formatNumber(totalTransactions)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Mumbai Stats */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            Polygon Mumbai
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Total Minted</p>
                                <p className="text-white text-xl font-semibold">{totalMinted} wSepETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Total Burned</p>
                                <p className="text-white text-xl font-semibold">{totalBurned} wSepETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Total Supply</p>
                                <p className="text-white text-xl font-semibold">{totalSupply} wSepETH</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-1">Transactions</p>
                                <p className="text-white text-xl font-semibold">{formatNumber(mintTransactions + burnTransactions)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-blue-400 text-sm">
                    ℹ️ Statistics are updated in real-time from the smart contracts on both chains.
                </p>
            </div>
        </div>
    );
}
