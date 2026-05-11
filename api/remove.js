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
  if (!documentId) {
    return sendError(res, 400, "documentId is required.");
  }

  let contract, wallet;
  try {
    ({ contract, wallet } = getContract());
  } catch (err) {
    return sendError(res, 500, err.message || "Server not configured.");
  }

  try {
    const tx = await contract.deactivateDocument(documentId);
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
    if (/not found/i.test(msg)) {
      return sendError(res, 404, "Document not found.");
    }
    if (/insufficient funds/i.test(msg)) {
      return sendError(res, 503, "Server wallet is out of testnet MATIC.");
    }
    return sendError(res, 500, msg);
  }
};
