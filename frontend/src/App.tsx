import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './components/Layout/Header';
import { BridgeForm } from './components/Bridge/BridgeForm';
import { TransactionHistory } from './components/TransactionHistory/TransactionHistory';
import { Stats } from './components/Stats/Stats';
import { ArrowRightLeft, History, BarChart3 } from 'lucide-react';

type Tab = 'bridge' | 'history' | 'stats';

function App() {
    const [activeTab, setActiveTab] = useState<Tab>('bridge');
    const { isConnected } = useAccount();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <Header />

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Cross-Chain Bridge
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Seamlessly transfer tokens between Ethereum Sepolia and Polygon Mumbai
                        using cryptographic proofs and trustless verification
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setActiveTab('bridge')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all ${activeTab === 'bridge'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <ArrowRightLeft size={20} />
                            Bridge
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all ${activeTab === 'history'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                            disabled={!isConnected}
                        >
                            <History size={20} />
                            History
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all ${activeTab === 'stats'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <BarChart3 size={20} />
                            Stats
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-2xl mx-auto">
                    {activeTab === 'bridge' && <BridgeForm />}
                    {activeTab === 'history' && <TransactionHistory />}
                    {activeTab === 'stats' && <Stats />}
                </div>

                {/* Features */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Secure</h3>
                        <p className="text-gray-400">
                            Cryptographic Merkle proofs ensure trustless verification of cross-chain transactions
                        </p>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Fast</h3>
                        <p className="text-gray-400">
                            Bridge transactions complete in 1-2 minutes with automatic relayer processing
                        </p>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Transparent</h3>
                        <p className="text-gray-400">
                            All transactions are verifiable on-chain with full transaction history tracking
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-16 text-center text-gray-500 text-sm">
                    <p>Built with ❤️ for the decentralized future</p>
                    <p className="mt-2">
                        Powered by Ethereum Sepolia & Polygon Mumbai Testnets
                    </p>
                </footer>
            </main>
        </div>
    );
}

export default App;
