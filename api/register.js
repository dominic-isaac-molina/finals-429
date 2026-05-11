const { getContract, readJsonBody, sendError } = require("./_contract");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendError(res, 400, "Invalid JSON body");
  }

  const documentId = String(body.documentId || "").trim();
  const fileHash = String(body.fileHash || "").trim().toLowerCase();
  const fileName = String(body.fileName || "").trim();

  if (!documentId || documentId.length > 128) {
    return sendError(res, 400, "Document ID is required (max 128 characters).");
  }
  if (!/^0x[0-9a-f]{64}$/.test(fileHash)) {
    return sendError(res, 400, "Invalid file hash. Expected a 0x-prefixed SHA-256.");
  }
  if (!fileName || fileName.length > 256) {
    return sendError(res, 400, "File name is required (max 256 characters).");
  }

  let contract, wallet;
  try {
    ({ contract, wallet } = getContract());
  } catch (err) {
    return sendError(res, 500, err.message || "Server not configured.");
  }

  try {
    const tx = await contract.registerDocument(documentId, fileHash, fileName);
    const receipt = await tx.wait();
    return res.status(200).json({
      ok: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      owner: wallet.address,
      documentId
    });
  } catch (err) {
    const msg = err.shortMessage || err.reason || err.message || "Transaction failed";
    if (/already exists/i.test(msg)) {
      return sendError(res, 409, "That document ID is already in use. Pick another.");
    }
    if (/insufficient funds/i.test(msg)) {
      return sendError(res, 503, "Server wallet is out of testnet MATIC. Refill at the faucet.");
    }
    return sendError(res, 500, msg);
  }
};
