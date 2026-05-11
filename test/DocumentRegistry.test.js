const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DocumentRegistry", function () {
  async function deployRegistry() {
    const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
    const registry = await DocumentRegistry.deploy();
    return registry;
  }

  it("registers a document hash", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt");

    expect(await registry.exists(uploader.address, "doc-1")).to.equal(true);
    expect(await registry.getDocumentCount(uploader.address)).to.equal(1);
  });

  it("prevents overwriting an existing document ID for the same uploader", async function () {
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt");

    await expect(
      registry.registerDocument("doc-1", hash, "hello-again.txt")
    ).to.be.revertedWith("Document already exists");
  });

  it("scopes documents by uploader so two wallets can use the same ID", async function () {
    const [uploaderA, uploaderB] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hashA = ethers.sha256(ethers.toUtf8Bytes("a"));
    const hashB = ethers.sha256(ethers.toUtf8Bytes("b"));

    await registry.connect(uploaderA).registerDocument("doc-1", hashA, "a.txt");
    await registry.connect(uploaderB).registerDocument("doc-1", hashB, "b.txt");

    expect((await registry.getDocument(uploaderA.address, "doc-1"))[0]).to.equal(hashA);
    expect((await registry.getDocument(uploaderB.address, "doc-1"))[0]).to.equal(hashB);
    expect(await registry.getDocumentCount(uploaderA.address)).to.equal(1);
    expect(await registry.getDocumentCount(uploaderB.address)).to.equal(1);
  });

  it("retrieves stored metadata correctly", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt");
    const document = await registry.getDocument(uploader.address, "doc-1");

    expect(document[0]).to.equal(hash);
    expect(document[1]).to.equal("hello.txt");
    expect(document[2]).to.be.greaterThan(0);
  });

  it("emits an event when a document is registered", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await expect(registry.registerDocument("doc-1", hash, "hello.txt"))
      .to.emit(registry, "DocumentRegistered")
      .withArgs(uploader.address, "doc-1", hash, "hello.txt", anyValue);
  });

  it("removes a document from the active list", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt");

    await expect(registry.deactivateDocument("doc-1"))
      .to.emit(registry, "DocumentRemoved")
      .withArgs(uploader.address, "doc-1");

    expect(await registry.exists(uploader.address, "doc-1")).to.equal(false);
    expect(await registry.getDocumentCount(uploader.address)).to.equal(0);
    await expect(registry.getDocument(uploader.address, "doc-1"))
      .to.be.revertedWith("Document not found");
  });

  it("allows a removed document ID to be registered again", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const oldHash = ethers.sha256(ethers.toUtf8Bytes("old"));
    const newHash = ethers.sha256(ethers.toUtf8Bytes("new"));

    await registry.registerDocument("doc-1", oldHash, "old.txt");
    await registry.deactivateDocument("doc-1");
    await registry.registerDocument("doc-1", newHash, "new.txt");

    const document = await registry.getDocument(uploader.address, "doc-1");
    expect(document[0]).to.equal(newHash);
    expect(document[1]).to.equal("new.txt");
    expect(await registry.getDocumentCount(uploader.address)).to.equal(1);
  });
});
