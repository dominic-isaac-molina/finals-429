# Deploying this project

There are two ways to run it:

1. **Free demo mode** — deploy only the frontend to Vercel. It saves document
   fingerprints in the visitor's browser with `localStorage`, so your professor
   can register, refresh, and verify files without any crypto funds.
2. **On-chain mode** — deploy the smart contract to Polygon Amoy and use the
   Vercel API routes to write to the public testnet.

If faucets are not giving you test MATIC, use **free demo mode**.

---

## Free demo mode for class testing

This costs nothing and needs no wallet funding.

1. Push this repo to GitHub.
2. Go to https://vercel.com → **Sign up with GitHub**.
3. Click **Add New → Project → Import** the repo.
4. Use:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command:** leave empty
   - **Output Directory:** `frontend`
5. Deploy.

Your professor can open the `.vercel.app` URL and test the workflow. The saved
documents persist in that browser. They are not shared across different
browsers unless you deploy the on-chain mode below.

---

## On-chain mode

Two things get deployed:

1. **The smart contract** to Polygon Amoy (a free Ethereum-compatible testnet).
2. **The site + API** to Vercel — static frontend plus three serverless
   functions (`/api/info`, `/api/register`) that sign on-chain
   transactions on behalf of visitors. No wallet install required.

Everything is free. No credit card required.

---

## 1. Make a throwaway wallet (one-time)

You only need a private key — no MetaMask UI required.

From the project folder run:

```bash
node -e "const w = require('ethers').Wallet.createRandom(); console.log('Address:    ', w.address); console.log('Private key:', w.privateKey)"
```

You'll see something like:

```
Address:     0xAbC...0123
Private key: 0xfedc...64-hex-chars
```

Save both somewhere safe. Treat the private key like a password — never paste
it into chat, never commit it to git.

---

## 2. Get free Amoy MATIC

Open https://faucet.polygon.technology/ and paste the **address** (not the
private key) into it. Pick **Polygon Amoy** as the network. Within ~60 seconds
you should have testnet MATIC.

This is the wallet that will both deploy the contract *and* sign every
transaction visitors make. Keep an eye on it: one faucet pull is enough for
hundreds of registrations, but if it runs dry the site stops working until you
refill.

---

## 3. Deploy the contract

```bash
cp .env.example .env
# open .env and paste the private key after PRIVATE_KEY=
npm install
npm run compile
npm run deploy:amoy
```

You should see:

```
DocumentRegistry deployed to 0x... on amoy
Wrote frontend/contract.js
```

`frontend/contract.js` now contains your deployed address, the ABI, and the
public address of the signer.

---

## 4. Test locally with the API

The static-only `npm run serve` works for browsing, but to test the
registration endpoint you need Vercel's local dev server, which runs the
serverless function:

```bash
npm install -g vercel
vercel dev           # the first time, follow the prompts to link the project
```

Open http://localhost:3000 (Vercel's default) and try registering a small file.

---

## 5. Deploy the site to Vercel

### Option A — GitHub (recommended)

1. Push the repo to GitHub.
2. Go to https://vercel.com → **Sign up with GitHub** (free, no card).
3. Click **Add New → Project → Import** the repo.
4. On the import screen:
   - **Framework Preset:** Other
   - **Root Directory:** keep as `./`
   - **Build Command:** leave empty
   - **Output Directory:** `frontend`
5. **Environment Variables** — scroll down and add:
   - `PRIVATE_KEY` = the same key you put in `.env` locally
   - (optional) `AMOY_RPC_URL` = a private Alchemy/Infura URL if you want
     stricter rate limits than the public Amoy RPC offers
6. Click **Deploy**.

You'll get a URL like `your-project.vercel.app`. Open it. No MetaMask, no
faucet, no install — just hit Register.

### Option B — CLI

```bash
vercel              # link the project
vercel env add PRIVATE_KEY    # paste the key when prompted, scope to all envs
vercel --prod
```

When asked for the output directory, answer `frontend`.

---

## 6. Updating later

- **Change frontend code?** Push to GitHub; Vercel auto-redeploys.
- **Change the contract?** Re-run `npm run deploy:amoy`. The script writes a
  new address into `frontend/contract.js`. Commit + push and Vercel picks it
  up. Old documents stay on the old address forever — that's blockchains.

---

## Costs

| Item | Cost |
|---|---|
| Polygon Amoy MATIC | Free from faucet |
| Vercel hobby plan | Free |
| Public Amoy RPC | Free |
| Domain (optional) | Free `.vercel.app` subdomain, or buy your own |

Total: **$0**.

---

## Troubleshooting

**"PRIVATE_KEY env var is missing on the server"** — You forgot the
environment variable on Vercel. Open the project → **Settings → Environment
Variables** → add `PRIVATE_KEY`. Then redeploy (Vercel won't pick up new env
vars on existing deployments automatically — trigger a new build).

**"Server wallet is out of testnet MATIC"** — Hit the faucet again with the
address shown in the page header.

**"insufficient funds for gas"** locally — Same thing: your throwaway wallet
needs Amoy MATIC.

**"Contract not deployed yet" banner won't go away** — `frontend/contract.js`
has an empty `address`. Run `npm run deploy:amoy` again, then commit and
push.

**Public RPC is rate-limited** — Sign up for a free Alchemy account at
https://alchemy.com, create an app on Polygon Amoy, copy the HTTPS URL, and
set it as `AMOY_RPC_URL` both locally (in `.env`) and on Vercel.

---

## A note on the architecture

This deploy uses one **shared signer**: every visitor's "register" click is
signed by the same wallet (your throwaway). The on-chain registry lives under
that one address. For a demo or class project that's exactly what you want —
the prof clicks a link, nothing else to set up.

If you ever want each visitor to sign with their *own* wallet (so the
on-chain owner reflects the actual user), the git history before this commit
shows the MetaMask-direct version: drop the `/api` folder, point the frontend
back at `ethers.BrowserProvider`, and you're there.
