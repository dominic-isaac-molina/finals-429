const fs = require("fs/promises");
const path = require("path");
const hre = require("hardhat");

const NETWORK_TO_CHAIN_ID = {
  amoy: 80002,
  localhost: 31337,
  hardhat: 31337
};

function hasValidPrivateKey(value) {
  if (!value) return false;

  const trimmed = value.trim();
  const withoutPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  return /^[0-9a-fA-F]{64}$/.test(withoutPrefix);
}

async function main() {
  if (hre.network.name === "amoy" && !hasValidPrivateKey(process.env.PRIVATE_KEY)) {
    throw new Error(
      "PRIVATE_KEY in .env must be a valid 64-character hex private key, not a wallet address. Paste it as PRIVATE_KEY=0x..."
    );
  }

  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const [deployer] = await hre.ethers.getSigners();
  const registry = await DocumentRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const serverAddress = deployer.address;
  const network = hre.network.name;
  const chainId = NETWORK_TO_CHAIN_ID[network] ?? Number(hre.network.config.chainId) ?? null;
  const deployment = {
    network,
    chainId,
    address,
    deployedAt: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  await fs.mkdir(deploymentsDir, { recursive: true });
  await fs.writeFile(
    path.join(deploymentsDir, `${network}.json`),
    JSON.stringify(deployment, null, 2)
  );

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "DocumentRegistry.sol",
    "DocumentRegistry.json"
  );
  const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
  const frontendConfig = {
    address,
    chainId,
    network,
    serverAddress,
    abi: artifact.abi
  };
  const frontendDir = path.join(__dirname, "..", "frontend");
  await fs.mkdir(frontendDir, { recursive: true });
  await fs.writeFile(
    path.join(frontendDir, "contract.js"),
    `window.CONTRACT_CONFIG = ${JSON.stringify(frontendConfig, null, 2)};\n`
  );

  console.log(`DocumentRegistry deployed to ${address} on ${network}`);
  console.log(`Wrote frontend/contract.js`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
