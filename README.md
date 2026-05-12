# Document Registry

A web app for proving a file hasn't been changed. You pick a file, the browser computes a SHA-256 hash of it, and that hash gets written to the Polygon Amoy testnet. Anyone who has the same file later can re-hash it in the browser and see if it still matches what was stored on-chain. The actual file never leaves your computer.

No wallet needed to use the site. The server signs transactions using its own wallet, so you just visit the page and start registering files.

## Running locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3001. If there's no deployed contract it runs in demo mode, which saves everything to localStorage. Good enough for testing register and verify without touching the blockchain.

For the full on-chain setup, see DEPLOY.md.

## Tests

```bash
npm test
```

## How it works

1. You pick a file in the browser.
2. The browser hashes it locally with SHA-256. Nothing gets uploaded.
3. The hash, filename, and a document ID you choose get sent to `/api/register`.
4. The server signs the transaction and submits it to the Polygon Amoy blockchain.
5. To verify later, you pick the same file again. The app re-hashes it and compares against what's on-chain. Matching hashes means the file is byte-for-byte identical to what was originally registered.

## Project structure

```
contracts/   Solidity smart contract
scripts/     deploy script
api/         serverless functions (Vercel)
frontend/    static web UI
test/        unit tests
DEPLOY.md   step-by-step deployment guide
```
