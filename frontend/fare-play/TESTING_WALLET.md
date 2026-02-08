# Testing Wallet Connection

## Setup

1. **Install Phantom Wallet** (if you haven't already):
   - Go to https://phantom.app/
   - Click "Download" and install the browser extension
   - Create a new wallet or import existing one
   - Make sure it's unlocked

2. **Start the dev server**:
```bash
cd /home/ashle/fare-play/frontend/fare-play
npm run dev
```

3. **Open the app**:
   - Go to http://localhost:3000
   - Open browser console (F12) to see debug logs

## Testing Steps

### 1. Check for Wallet Detection

When the page loads, you should see console logs like:
```
[WalletConnect] Detecting wallets...
[WalletConnect] window.phantom: true
[WalletConnect] ✓ Phantom detected
[WalletConnect] Total wallets found: 1
```

**If you see "Total wallets found: 0":**
- Make sure Phantom extension is installed and enabled
- Try refreshing the page
- Make sure Phantom is unlocked

### 2. Click Connect Wallet Button

Look for the purple "Connect Wallet" button in the top right of the navigation bar.

When you click it, you should see:
```
[WalletConnect] Button clicked! Available wallets: 1
[WalletConnect] Single wallet, connecting directly...
[WalletConnect] Attempting to connect... Phantom
[WalletConnect] Calling connect()...
```

**Then Phantom should pop up** asking you to connect.

### 3. Approve Connection

In the Phantom popup:
- Click "Connect" or "Approve"

You should see:
```
[WalletConnect] ✓ Connected successfully: [response object]
```

And the button should change to show your wallet address like: **"AbC1...xYz9"** (green button)

### 4. Test Disconnect

Click the button again when connected - it should disconnect and go back to "Connect Wallet"

## Troubleshooting

### Button doesn't respond when clicked
- Check browser console for errors
- Make sure JavaScript is enabled
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### "No Solana wallet detected" alert
- Install Phantom: https://phantom.app/
- Make sure extension is enabled in browser settings
- Try refreshing the page after installing

### Phantom doesn't pop up
- Make sure Phantom is unlocked
- Check if popup was blocked by browser
- Try clicking the Phantom extension icon manually
- Check browser console for connection errors

### Console shows errors
- Look for error messages starting with `[WalletConnect]`
- Common issues:
  - `User rejected the request` - You clicked cancel in Phantom
  - `Connection timeout` - Phantom might be locked or unresponsive
  - `undefined` errors - Wallet adapter might not be properly loaded

## Expected Console Output (Success)

```
[WalletConnect] Detecting wallets...
[WalletConnect] window.phantom: true
[WalletConnect] window.solana: true
[WalletConnect] ✓ Phantom detected
[WalletConnect] Total wallets found: 1

[User clicks button]

[WalletConnect] Button clicked! Available wallets: 1
[WalletConnect] Single wallet, connecting directly...
[WalletConnect] Attempting to connect... Phantom
[WalletConnect] Calling connect()...
[WalletConnect] ✓ Connected successfully: {publicKey: ..., ...}
```

## Next Steps After Connection Works

Once wallet connection is working, we can:
1. Test the VaultCard component (deposit/withdraw SOL)
2. Integrate betting functionality into StopSidebar
3. Build out the full prediction market UI
