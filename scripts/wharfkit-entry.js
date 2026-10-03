// Anchor and Wombat sign-in for the Keyroom page (WAX Cloud Wallet stays on waxjs).
// Rebuild: npx esbuild entry.js --bundle --minify --format=iife --define:global=globalThis --outfile=wharfkit.bundle.js
import { SessionKit } from '@wharfkit/session'
import { WebRenderer } from '@wharfkit/web-renderer'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { WalletPluginWombat } from '@wharfkit/wallet-plugin-wombat'

const sessionKit = new SessionKit({
  appName: 'keyroom',
  chains: [{
    id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    url: 'https://wax.greymass.com',
  }],
  ui: new WebRenderer(),
  walletPlugins: [new WalletPluginAnchor(), new WalletPluginWombat()],
})

// walletPlugin: 'anchor' or 'wombat'. Resolves to the WAX account name.
window.wharfLogin = async (walletPlugin) => {
  const { session } = await sessionKit.login({ walletPlugin })
  return String(session.actor)
}
