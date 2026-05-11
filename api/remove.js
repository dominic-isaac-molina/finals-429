module.exports = async (req, res) => {
  res.status(410).json({
    error: "Documents are append-only and cannot be removed."
  });
};
