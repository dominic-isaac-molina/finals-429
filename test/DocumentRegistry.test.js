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
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt", "doc-1-hello.txt");

    expect(await registry.exists("doc-1")).to.equal(true);
    expect(await registry.getDocumentCount()).to.equal(1);
  });

  it("prevents overwriting an existing document ID", async function () {
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt", "doc-1-hello.txt");

    await expect(
      registry.registerDocument("doc-1", hash, "hello-again.txt", "other.txt")
    ).to.be.revertedWith("Document already exists");
  });

  it("retrieves stored metadata correctly", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt", "doc-1-hello.txt");
    const document = await registry.getDocument("doc-1");

    expect(document[0]).to.equal("doc-1");
    expect(document[1]).to.equal(hash);
    expect(document[2]).to.equal("hello.txt");
    expect(document[3]).to.equal(uploader.address);
    expect(document[4]).to.be.greaterThan(0);
    expect(document[5]).to.equal("doc-1-hello.txt");
  });

  it("emits an event when a document is registered", async function () {
    const [uploader] = await ethers.getSigners();
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await expect(registry.registerDocument("doc-1", hash, "hello.txt", "doc-1-hello.txt"))
      .to.emit(registry, "DocumentRegistered")
      .withArgs("doc-1", hash, "hello.txt", uploader.address, anyValue, "doc-1-hello.txt");
  });

  it("removes a document from the active list", async function () {
    const registry = await deployRegistry();
    const hash = ethers.sha256(ethers.toUtf8Bytes("hello"));

    await registry.registerDocument("doc-1", hash, "hello.txt", "doc-1-hello.txt");

    await expect(registry.deactivateDocument("doc-1"))
      .to.emit(registry, "DocumentRemoved")
      .withArgs("doc-1");

    expect(await registry.exists("doc-1")).to.equal(false);
    expect(await registry.getDocumentCount()).to.equal(0);
    await expect(registry.getDocument("doc-1")).to.be.revertedWith("Document not found");
  });

  it("allows a removed document ID to be registered again", async function () {
    const registry = await deployRegistry();
    const oldHash = ethers.sha256(ethers.toUtf8Bytes("old"));
    const newHash = ethers.sha256(ethers.toUtf8Bytes("new"));

    await registry.registerDocument("doc-1", oldHash, "old.txt", "old.txt");
    await registry.deactivateDocument("doc-1");
    await registry.registerDocument("doc-1", newHash, "new.txt", "new.txt");

    const document = await registry.getDocument("doc-1");
    expect(document[1]).to.equal(newHash);
    expect(document[2]).to.equal("new.txt");
    expect(await registry.getDocumentCount()).to.equal(1);
  });
});
