// Shared helper for the Vercel serverless API routes.
// Reads the contract address + ABI from the same file the frontend uses
// (frontend/contract.js), so both sides stay in sync after every deploy.

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

let cached = null;

function loadConfig() {
  if (cached) return cached;

  const configPath = path.join(process.cwd(), "frontend", "contract.js");
  const code = fs.readFileSync(configPath, "utf8");
  const sandbox = { window: {} };
  // The file is one assignment to window.CONTRACT_CONFIG; running it in a
  // sandboxed Function gives us that object without needing eval.
  new Function("window", code)(sandbox.window);
  cached = sandbox.window.CONTRACT_CONFIG || {};
  return cached;
}

function getEnv() {
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();
  const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY env var is missing on the server.");
  }

  const normalized = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY env var is not a valid 64-character hex key.");
  }

  return { PRIVATE_KEY: normalized, AMOY_RPC_URL };
}

function getContract({ readOnly } = {}) {
  const { address, abi } = loadConfig();
  if (!address) {
    throw new Error("Contract address is empty in frontend/contract.js. Run `npm run deploy:amoy` first.");
  }
  const { PRIVATE_KEY, AMOY_RPC_URL } = getEnv();
  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  if (readOnly) {
    return { contract: new ethers.Contract(address, abi, provider), provider };
  }
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return {
    contract: new ethers.Contract(address, abi, wallet),
    provider,
    wallet
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      if (typeof req.body === "string") {
        try { return resolve(JSON.parse(req.body)); } catch (e) { return reject(e); }
      }
      return resolve(req.body);
    }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

module.exports = {
  loadConfig,
  getContract,
  readJsonBody,
  sendError
};
