const fs = require("fs");
const path = require("path");
const { readJsonBody, sendError } = require("./_contract");

const STORE = path.join("/tmp", "thumbnails.json");

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE, "utf8")); }
  catch { return {}; }
}

function writeStore(data) {
  fs.writeFileSync(STORE, JSON.stringify(data));
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return res.status(200).json(readStore());
  }

  if (req.method === "POST") {
    let body;
    try { body = await readJsonBody(req); }
    catch { return sendError(res, 400, "Invalid JSON"); }

    const { docId, thumbnail } = body;
    if (!docId || !thumbnail) return sendError(res, 400, "docId and thumbnail required");

    const store = readStore();
    store[docId] = thumbnail;
    try { writeStore(store); }
    catch { return sendError(res, 500, "Failed to save thumbnail"); }

    return res.status(200).json({ ok: true });
  }

  sendError(res, 405, "Method not allowed");
};
