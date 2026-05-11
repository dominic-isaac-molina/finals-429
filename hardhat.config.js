require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

function normalizePrivateKey(value) {
  if (!value) return null;

  const trimmed = value.trim();
  const withoutPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;

  if (!/^[0-9a-fA-F]{64}$/.test(withoutPrefix)) {
    return null;
  }

  return `0x${withoutPrefix}`;
}

const AMOY_ACCOUNTS = normalizePrivateKey(PRIVATE_KEY)
  ? [normalizePrivateKey(PRIVATE_KEY)]
  : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: AMOY_ACCOUNTS
    }
  }
};
