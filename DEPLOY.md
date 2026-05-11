# Deploying this project

Two things get deployed:

1. **The smart contract** to Polygon Amoy (a free Ethereum-compatible testnet).
2. **The frontend** to Vercel as a static site.

Everything is free. No credit card required.

---

## 1. One-time wallet setup

You only do this once.

1. **Install [MetaMask](https://metamask.io/download/)** as a browser extension.
2. Inside MetaMask, click the account icon → **Add account or hardware wallet → Add a new account**. Name it something like *Amoy Deployer*. Treat this account as throwaway — never put real money in it.
3. **Export the private key for that throwaway account.** In MetaMask:
   *Account menu → Account details → Show private key*. Paste your password, then copy the key.
   You'll paste it into `.env` in the next step. Keep it secret.
4. **Get free Amoy MATIC.** Visit one of:
   - https://faucet.polygon.technology/ (Amoy network)
   - https://www.alchemy.com/faucets/polygon-amoy

   Paste your throwaway wallet address. You should receive a small amount of
   MATIC within ~1 minute. That's enough for hundreds of deploys.

---

## 2. Deploy the contract

From the project root:

```bash
cp .env.example .env
# open .env and paste your throwaway wallet's private key into PRIVATE_KEY
npm install
npm run compile
npm run deploy:amoy
```

You should see something like:

```
DocumentRegistry deployed to 0xAbCd…1234 on amoy
Wrote frontend/contract.js
```

`frontend/contract.js` now has your deployed address and ABI baked in.

You can also confirm the deploy at
`https://amoy.polygonscan.com/address/0xAbCd…1234` — paste your address there.

---

## 3. Test it locally

```bash
npm run serve
```

Open http://localhost:3001 and connect MetaMask. Make sure MetaMask is on the
Polygon Amoy network (the app will offer to switch/add it for you).

Try uploading a small file and clicking *Register on-chain*. MetaMask will pop
up to sign — confirm. Within a couple of seconds it should appear in
*Your documents*.

---

## 4. Deploy the frontend to Vercel

The frontend is plain static HTML/JS, so this is fast.

### Option A — the GitHub way (recommended)

1. Push this repo to GitHub.
2. Go to https://vercel.com → **Sign up with GitHub** (free, no card).
3. Click **Add New → Project → Import** the repo.
4. On the import screen:
   - **Framework Preset:** Other
   - **Root Directory:** keep as `./`
   - **Build Command:** leave empty
   - **Output Directory:** `frontend`
5. Click **Deploy**.

You'll get a URL like `your-project.vercel.app`. Visit it, connect MetaMask,
and your dApp is live.

### Option B — the CLI way

```bash
npm install -g vercel
vercel        # walks you through linking the project
vercel --prod # deploys to production
```

When asked for the output directory, answer `frontend`.

---

## 5. Updating later

- **Change frontend code?** Push to GitHub; Vercel auto-redeploys.
- **Change the contract?** Re-run `npm run deploy:amoy`. This deploys a *new*
  contract at a new address and rewrites `frontend/contract.js`. Commit and
  push that file so Vercel picks it up.
- **Documents already on the old contract** stay on the old address forever
  (that's blockchains for you). If you want to keep them, don't redeploy.

---

## Costs

- Polygon Amoy MATIC: free from faucets.
- MetaMask: free.
- Vercel hobby plan: free.
- Public Amoy RPC: free.

Total: $0.

---

## Troubleshooting

**"insufficient funds for gas"** — Your throwaway wallet ran out of Amoy
MATIC. Hit the faucet again.

**MetaMask says "wrong network"** — Click the wallet pill in the app header
to reconnect; it should prompt you to switch to Amoy.

**Frontend shows "Contract not deployed yet"** — `frontend/contract.js` has
no address. Run `npm run deploy:amoy` again, then make sure that file was
committed.

**Public RPC is rate-limited** — Sign up for a free Alchemy account at
https://alchemy.com, create an app on Polygon Amoy, and put the HTTPS URL
into `.env` as `AMOY_RPC_URL`.
