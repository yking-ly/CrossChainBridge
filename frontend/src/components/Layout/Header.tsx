import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link2 } from 'lucide-react';

export function Header() {
    return (
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Link2 className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Cross-Chain Bridge</h1>
                            <p className="text-xs text-gray-400">Sepolia ↔ Mumbai</p>
                        </div>
                    </div>

                    {/* Connect Button */}
                    <ConnectButton
                        chainStatus="icon"
                        showBalance={false}
                    />
                </div>
            </div>
        </header>
    );
}
