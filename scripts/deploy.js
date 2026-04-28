const fs = require("fs/promises");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const registry = await DocumentRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const network = hre.network.name;
  const deployment = {
    network,
    address,
    deployedAt: new Date().toISOString()
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, `${network}.json`),
    JSON.stringify(deployment, null, 2)
  );

  console.log(`DocumentRegistry deployed to ${address} on ${network}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
