require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { ethers } = require("ethers");

const upload = multer({ storage: multer.memoryStorage() });

function hashBuffer(buffer) {
  return `0x${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(`0x${hash.digest("hex")}`));
  });
}

function safeName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storedFilePath(uploadDir, storagePointer) {
  return path.join(uploadDir, path.basename(storagePointer));
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatDocument(document) {
  return {
    documentId: document[0],
    fileHash: document[1],
    fileName: document[2],
    uploader: document[3],
    timestamp: Number(document[4]),
    storagePointer: document[5]
  };
}

function createTransactionQueue(contract) {
  let queue = Promise.resolve();

  return function queueTransaction(sendTransaction) {
    const run = queue.then(async () => {
      const overrides = {};

      if (contract.runner && typeof contract.runner.getNonce === "function") {
        overrides.nonce = await contract.runner.getNonce("pending");
      }

      return sendTransaction(overrides);
    });

    queue = run.catch(() => {});
    return run;
  };
}

async function getContract() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "DocumentRegistry.sol",
    "DocumentRegistry.json"
  );

  const deployment = JSON.parse(await fsp.readFile(deploymentPath, "utf8"));
  const artifact = JSON.parse(await fsp.readFile(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(deployment.address);

  if (code === "0x") {
    throw new Error(
      `No contract found at ${deployment.address}. Run npm run deploy:localhost after starting npm run node.`
    );
  }

  const signer = new ethers.Wallet(privateKey, provider);

  return new ethers.Contract(deployment.address, artifact.abi, signer);
}

function createApp(contract, uploadDir = path.join(__dirname, "..", "uploads")) {
  const app = express();
  const queueTransaction = createTransactionQueue(contract);

  app.use(cors());
  app.use(express.json());

  app.post("/documents/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "file is required" });
      }

      const documentId = req.body.documentId || crypto.randomUUID();
      const fileName = safeName(req.file.originalname);
      const fileHash = hashBuffer(req.file.buffer);
      const storagePointer = `${crypto.randomUUID()}-${fileName}`;
      const filePath = storedFilePath(uploadDir, storagePointer);

      if (await contract.exists(documentId)) {
        return res.status(409).json({ error: "Document already exists" });
      }

      await fsp.mkdir(uploadDir, { recursive: true });
      await fsp.writeFile(filePath, req.file.buffer);

      try {
        const tx = await queueTransaction((overrides) =>
          contract.registerDocument(documentId, fileHash, fileName, storagePointer, overrides)
        );
        await tx.wait();
      } catch (error) {
        await fsp.unlink(filePath).catch(() => {});
        throw error;
      }

      const document = formatDocument(await contract.getDocument(documentId));
      res.status(201).json(document);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/documents", async (req, res) => {
    try {
      const ids = await contract.getDocumentIds();
      const documents = await Promise.all(
        ids.map(async (id) => formatDocument(await contract.getDocument(id)))
      );

      res.json({ documents });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/documents/:id/download", async (req, res) => {
    try {
      const document = formatDocument(await contract.getDocument(req.params.id));
      const filePath = storedFilePath(uploadDir, document.storagePointer);

      if (!(await fileExists(filePath))) {
        return res.status(404).json({ error: "Stored file not found" });
      }

      res.download(filePath, document.fileName);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/documents/:id", async (req, res) => {
    try {
      const document = formatDocument(await contract.getDocument(req.params.id));
      const tx = await queueTransaction((overrides) =>
        contract.deactivateDocument(req.params.id, overrides)
      );
      await tx.wait();
      await fsp.unlink(storedFilePath(uploadDir, document.storagePointer)).catch(() => {});
      res.json({
        documentId: req.params.id,
        removed: true,
        removedAt: new Date().toISOString()
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/documents/:id/verify", upload.single("file"), async (req, res) => {
    try {
      const document = formatDocument(await contract.getDocument(req.params.id));
      const storedPath = storedFilePath(uploadDir, document.storagePointer);

      if (!req.file && !(await fileExists(storedPath))) {
        return res.status(404).json({ error: "Stored file not found" });
      }

      const actualHash = req.file
        ? hashBuffer(req.file.buffer)
        : await hashFile(storedPath);

      res.json({
        documentId: document.documentId,
        valid: actualHash === document.fileHash,
        expectedHash: document.fileHash,
        actualHash
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.use(express.static(path.join(__dirname, "..", "frontend")));

  return app;
}

function sendError(res, error) {
  const message = error.shortMessage || error.reason || error.message;

  if (message.includes("Document not found")) {
    return res.status(404).json({ error: "Document not found" });
  }

  if (message.includes("Document already exists")) {
    return res.status(409).json({ error: "Document already exists" });
  }

  if (message.includes("ENOENT")) {
    return res.status(404).json({ error: "Stored file not found" });
  }

  return res.status(500).json({ error: message });
}

async function main() {
  const contract = await getContract();
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
  const app = createApp(contract, uploadDir);
  const port = Number(process.env.PORT || 3001);

  app.listen(port, () => {
    console.log(`Document verification API listening on http://localhost:${port}`);
    console.log(`Frontend available at http://localhost:${port}/`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Failed to start backend API:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  createApp,
  hashBuffer
};
