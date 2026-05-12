const { loadConfig, getContract, sendError } = require("./_contract");

module.exports = async (req, res) => {
  try {
    const cfg = loadConfig();
    const { wallet } = getContract();
    res.status(200).json({
      address: cfg.address,
      chainId: cfg.chainId,
      network: cfg.network,
      serverAddress: wallet.address
    });
  } catch (err) {
    sendError(res, 500, err.message || "Server not configured.");
  }
};
