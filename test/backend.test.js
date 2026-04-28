const path = require("path");
const fs = require("fs/promises");
const request = require("supertest");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createApp, hashBuffer } = require("../backend/server");

describe("Backend document API", function () {
  let app;
  let uploadDir;
  let registry;

  beforeEach(async function () {
    const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
    const contract = await DocumentRegistry.deploy();
    registry = contract;
    uploadDir = path.join(__dirname, "..", ".tmp-test-uploads", cryptoId());
    app = createApp(registry, uploadDir);
  });

  afterEach(async function () {
    await fs.rm(path.join(__dirname, "..", ".tmp-test-uploads"), { recursive: true, force: true });
  });

  it("serves the plain frontend", async function () {
    const response = await request(app)
      .get("/")
      .expect(200);

    expect(response.text).to.include("Document Verification");
    expect(response.text).to.include("/documents/upload");
    expect(response.text).to.include("Uploaded At");
    expect(response.text).to.include("Remove from Active List");
  });

  it("upload stores a file and creates a hash", async function () {
    const file = Buffer.from("final project document");

    const response = await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", file, "project.txt")
      .expect(201);

    expect(response.body.documentId).to.equal("doc-1");
    expect(response.body.fileHash).to.equal(hashBuffer(file));
    expect(response.body.storagePointer).to.include("project.txt");
    await fs.access(path.join(uploadDir, response.body.storagePointer));
  });

  it("hash sent to the contract matches the local file hash", async function () {
    const file = Buffer.from("contract hash check");

    await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", file, "hash.txt")
      .expect(201);

    const document = await registry.getDocument("doc-1");
    expect(document[1]).to.equal(hashBuffer(file));
  });

  it("uploads multiple different files without nonce conflicts", async function () {
    const uploads = await Promise.all([
      request(app)
        .post("/documents/upload")
        .field("documentId", "doc-1")
        .attach("file", Buffer.from("first"), "first.txt")
        .expect(201),
      request(app)
        .post("/documents/upload")
        .field("documentId", "doc-2")
        .attach("file", Buffer.from("second"), "second.txt")
        .expect(201),
      request(app)
        .post("/documents/upload")
        .field("documentId", "doc-3")
        .attach("file", Buffer.from("third"), "third.txt")
        .expect(201)
    ]);

    const ids = uploads.map((response) => response.body.documentId).sort();
    const listResponse = await request(app)
      .get("/documents")
      .expect(200);

    expect(ids).to.deep.equal(["doc-1", "doc-2", "doc-3"]);
    expect(listResponse.body.documents).to.have.length(3);
  });

  it("verification succeeds for unchanged stored files", async function () {
    await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", Buffer.from("unchanged"), "proof.txt")
      .expect(201);

    const response = await request(app)
      .post("/documents/doc-1/verify")
      .expect(200);

    expect(response.body.valid).to.equal(true);
  });

  it("verification fails for modified files", async function () {
    await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", Buffer.from("original"), "proof.txt")
      .expect(201);

    const response = await request(app)
      .post("/documents/doc-1/verify")
      .attach("file", Buffer.from("tampered"), "proof.txt")
      .expect(200);

    expect(response.body.valid).to.equal(false);
  });

  it("duplicate upload does not replace the original local file", async function () {
    const original = Buffer.from("original file");

    const firstResponse = await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", original, "proof.txt")
      .expect(201);

    await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", Buffer.from("replacement file"), "proof.txt")
      .expect(409);

    const files = await fs.readdir(uploadDir);
    const savedFile = await fs.readFile(path.join(uploadDir, firstResponse.body.storagePointer));

    expect(files).to.deep.equal([firstResponse.body.storagePointer]);
    expect(savedFile).to.deep.equal(original);
  });

  it("missing document IDs return a clear error", async function () {
    const response = await request(app)
      .post("/documents/missing/verify")
      .expect(404);

    expect(response.body.error).to.equal("Document not found");
  });

  it("remove hides the document from the active list and removes the local file", async function () {
    await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", Buffer.from("remove me"), "remove.txt")
      .expect(201);

    const uploaded = await request(app)
      .get("/documents")
      .expect(200);
    const filePath = path.join(uploadDir, uploaded.body.documents[0].storagePointer);
    await fs.access(filePath);

    const response = await request(app)
      .delete("/documents/doc-1")
      .expect(200);

    expect(response.body.documentId).to.equal("doc-1");
    expect(response.body.removed).to.equal(true);
    expect(response.body.removedAt).to.be.a("string");
    let fileStillExists = true;
    try {
      await fs.access(filePath);
    } catch {
      fileStillExists = false;
    }
    expect(fileStillExists).to.equal(false);

    const listResponse = await request(app)
      .get("/documents")
      .expect(200);

    expect(listResponse.body.documents).to.deep.equal([]);
  });

  it("stored verification returns a clear error when the local file is missing", async function () {
    const response = await request(app)
      .post("/documents/upload")
      .field("documentId", "doc-1")
      .attach("file", Buffer.from("missing local file"), "missing.txt")
      .expect(201);

    await fs.unlink(path.join(uploadDir, response.body.storagePointer));

    const verifyResponse = await request(app)
      .post("/documents/doc-1/verify")
      .expect(404);

    expect(verifyResponse.body.error).to.equal("Stored file not found");
  });

  it("supports the final demo flow", async function () {
    const original = Buffer.from("demo file");

    await request(app)
      .post("/documents/upload")
      .field("documentId", "demo-doc")
      .attach("file", original, "demo.txt")
      .expect(201);

    const validResponse = await request(app)
      .post("/documents/demo-doc/verify")
      .attach("file", original, "demo.txt")
      .expect(200);

    const tamperedResponse = await request(app)
      .post("/documents/demo-doc/verify")
      .attach("file", Buffer.from("demo file but changed"), "demo.txt")
      .expect(200);

    expect(validResponse.body.valid).to.equal(true);
    expect(tamperedResponse.body.valid).to.equal(false);
  });
});

function cryptoId() {
  return Math.random().toString(16).slice(2);
}
