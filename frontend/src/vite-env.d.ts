/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WALLETCONNECT_PROJECT_ID: string
    readonly VITE_SEPOLIA_BRIDGE_VAULT: string
    readonly VITE_SEPOLIA_BRIDGE_VALIDATOR: string
    readonly VITE_AMOY_BRIDGE_TOKEN: string
    readonly VITE_AMOY_BRIDGE_VALIDATOR: string
    readonly VITE_MUMBAI_BRIDGE_TOKEN?: string
    readonly VITE_MUMBAI_BRIDGE_VALIDATOR?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
