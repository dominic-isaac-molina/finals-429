// The Express backend has been removed in favor of a fully browser-direct dApp.
// The frontend now talks to the DocumentRegistry contract via MetaMask + ethers.js
// over the Polygon Amoy testnet, so no local server is required.
//
// To run the app locally now:
//   1. Open frontend/index.html in any static file server, e.g.
//        npx serve frontend
//      or just open it directly in your browser.
//   2. Make sure frontend/contract.js exists (it is written by
//      `npm run deploy:amoy` and contains the deployed contract address + ABI).
//
// To run the old local-Hardhat flow, check out the git history before this commit.
module.exports = {};
