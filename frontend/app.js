(() => {
  "use strict";

  const AMOY = {
    chainIdHex: "0x13882", // 80002
    chainId: 80002,
    chainName: "Polygon Amoy",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com/"]
  };

  const cfg = window.CONTRACT_CONFIG || {};

  // ---- DOM ----
  const walletBtn   = document.getElementById("wallet-btn");
  const walletText  = document.getElementById("wallet-text");
  const banners     = document.getElementById("setup-banners");
  const registerForm = document.getElementById("register-form");
  const registerBtn  = document.getElementById("register-btn");
  const verifyForm   = document.getElementById("verify-form");
  const verifyBtn    = document.getElementById("verify-btn");
  const verifySelect = document.getElementById("verify-id");
  const docsBody     = document.getElementById("docs-body");
  const toastEl      = document.getElementById("toast");
  const contractLink = document.getElementById("contract-link");

  // ---- State ----
  let provider = null;        // BrowserProvider
  let signer = null;
  let userAddress = null;
  let contractRead = null;    // contract with provider (read-only)
  let contractWrite = null;   // contract with signer
  let cachedDocs = [];

  // ---- Utilities ----
  function shortAddr(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function shortHash(h) {
    if (!h) return "";
    return h.slice(0, 10) + "…" + h.slice(-6);
  }

  function fmtDate(unixSec) {
    if (!unixSec) return "—";
    const d = new Date(Number(unixSec) * 1000);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  }

  let toastTimer;
  function toast(msg, kind) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = "toast " + (kind || "");
    toastEl.style.display = "block";
    toastTimer = setTimeout(() => { toastEl.style.display = "none"; }, 3800);
  }

  function setBanner(html) {
    banners.innerHTML = html || "";
  }

  async function hashFile(file) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return "0x" + hex;
  }

  function explorerTx(txHash) {
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  }

  function explorerAddr(addr) {
    return `https://amoy.polygonscan.com/address/${addr}`;
  }

  // ---- Wallet flow ----
  async function connectWallet() {
    if (!window.ethereum) {
      toast("MetaMask not found. Install it and reload.", "error");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      userAddress = await signer.getAddress();
      walletBtn.classList.add("connected");
      walletText.textContent = shortAddr(userAddress);

      await ensureAmoy();
      attachContract();
      await refreshDocs();
    } catch (err) {
      toast(err.message || "Wallet connection cancelled.", "error");
    }
  }

  async function ensureAmoy() {
    const network = await provider.getNetwork();
    if (Number(network.chainId) === AMOY.chainId) {
      renderBanners();
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY.chainIdHex }]
      });
    } catch (err) {
      // 4902 = chain not added
      if (err && (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902))) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: AMOY.chainIdHex,
            chainName: AMOY.chainName,
            nativeCurrency: AMOY.nativeCurrency,
            rpcUrls: AMOY.rpcUrls,
            blockExplorerUrls: AMOY.blockExplorerUrls
          }]
        });
      } else {
        throw err;
      }
    }
    // Refresh signer/provider after switch
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    renderBanners();
  }

  function attachContract() {
    if (!cfg.address) return;
    contractRead = new ethers.Contract(cfg.address, cfg.abi, provider);
    contractWrite = new ethers.Contract(cfg.address, cfg.abi, signer);
    contractLink.href = explorerAddr(cfg.address);
  }

  function renderBanners() {
    if (!cfg.address) {
      setBanner(`
        <div class="banner warn">
          <b>Contract not deployed yet.</b>
          <p>Run <code>npm run deploy:amoy</code> to deploy your copy of the
          DocumentRegistry contract. The deploy script writes the address into
          <code>frontend/contract.js</code> automatically.</p>
        </div>
      `);
      return;
    }
    setBanner("");
  }

  // ---- Documents ----
  async function refreshDocs() {
    if (!contractRead || !userAddress) {
      docsBody.innerHTML = '<tr><td colspan="5" class="empty">Connect your wallet to see your documents.</td></tr>';
      return;
    }
    try {
      const ids = await contractRead.getDocumentIds(userAddress);
      const items = [];
      for (const id of ids) {
        const [fileHash, fileName, ts] = await contractRead.getDocument(userAddress, id);
        items.push({ id, fileHash, fileName, ts: Number(ts) });
      }
      cachedDocs = items;
      renderDocs(items);
      renderVerifyOptions(items);
    } catch (err) {
      console.error(err);
      docsBody.innerHTML = `<tr><td colspan="5" class="empty">Couldn't load documents: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderDocs(items) {
    if (!items.length) {
      docsBody.innerHTML = '<tr><td colspan="5" class="empty">No documents yet. Register one above.</td></tr>';
      return;
    }
    docsBody.innerHTML = items.map(doc => `
      <tr>
        <td class="doc-id">${escapeHtml(doc.id)}</td>
        <td>${escapeHtml(doc.fileName)}</td>
        <td>${escapeHtml(fmtDate(doc.ts))}</td>
        <td class="hash-cell mono" title="${escapeHtml(doc.fileHash)}">${escapeHtml(shortHash(doc.fileHash))}</td>
        <td>
          <div class="row-actions">
            <button class="link" data-action="copy" data-hash="${escapeHtml(doc.fileHash)}">Copy hash</button>
            <button class="link danger" data-action="remove" data-id="${escapeHtml(doc.id)}">Remove</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderVerifyOptions(items) {
    const prev = verifySelect.value;
    verifySelect.innerHTML = '<option value="">— pick one —</option>' +
      items.map(doc =>
        `<option value="${escapeHtml(doc.id)}">${escapeHtml(doc.id)} — ${escapeHtml(doc.fileName)}</option>`
      ).join("");
    if (prev) verifySelect.value = prev;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ---- Register ----
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contractWrite) {
      if (!cfg.address) return toast("Deploy the contract first.", "error");
      return toast("Connect your wallet first.", "error");
    }
    const file = document.getElementById("register-file").files[0];
    const docId = document.getElementById("register-id").value.trim();
    if (!file || !docId) return toast("Pick a file and an ID.", "error");

    try {
      registerBtn.disabled = true;
      registerBtn.textContent = "Hashing…";
      const hash = await hashFile(file);

      registerBtn.textContent = "Waiting for wallet…";
      const tx = await contractWrite.registerDocument(docId, hash, file.name);

      registerBtn.textContent = "Confirming…";
      const receipt = await tx.wait();

      toast(`Registered "${docId}". View tx →`, "success");
      // Make the toast a link
      toastEl.style.cursor = "pointer";
      toastEl.onclick = () => window.open(explorerTx(receipt.hash), "_blank");

      registerForm.reset();
      await refreshDocs();
    } catch (err) {
      console.error(err);
      const msg = err.shortMessage || err.reason || err.message || "Transaction failed";
      toast(msg.includes("already exists") ? "That document ID is already used in this wallet." : msg, "error");
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = "Register on-chain";
    }
  });

  // ---- Verify ----
  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contractRead) return toast("Connect your wallet first.", "error");
    const docId = verifySelect.value;
    const file = document.getElementById("verify-file").files[0];
    if (!docId || !file) return toast("Pick a document and a file.", "error");

    try {
      verifyBtn.disabled = true;
      verifyBtn.textContent = "Checking…";
      const [expected] = await contractRead.getDocument(userAddress, docId);
      const actual = await hashFile(file);
      showResult(expected, actual, file.name);
    } catch (err) {
      toast(err.shortMessage || err.message || "Verify failed.", "error");
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Compare fingerprints";
    }
  });

  function showResult(expected, actual, fileName) {
    const valid = expected.toLowerCase() === actual.toLowerCase();
    const title = document.getElementById("result-title");
    title.textContent = valid ? "Match." : "No match.";
    title.className = valid ? "valid" : "invalid";
    document.getElementById("result-subtitle").textContent = valid
      ? `${fileName} is identical to what was registered on-chain.`
      : `${fileName} differs from what was registered. It may have been edited or it's a different file.`;
    document.getElementById("result-expected").textContent = expected;
    document.getElementById("result-actual").textContent = actual;
    document.getElementById("result-overlay").classList.remove("hidden");
  }

  window.closeResult = function () {
    document.getElementById("result-overlay").classList.add("hidden");
  };

  // ---- Row actions ----
  docsBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(btn.dataset.hash);
        toast("Hash copied.", "success");
      } catch {
        toast("Couldn't copy.", "error");
      }
    } else if (action === "remove") {
      const id = btn.dataset.id;
      if (!confirm(`Remove "${id}" from your registry? This sends a transaction.`)) return;
      try {
        btn.disabled = true;
        const tx = await contractWrite.deactivateDocument(id);
        await tx.wait();
        toast(`Removed "${id}".`, "success");
        await refreshDocs();
      } catch (err) {
        toast(err.shortMessage || err.message || "Remove failed.", "error");
      } finally {
        btn.disabled = false;
      }
    }
  });

  // ---- Wallet button ----
  walletBtn.addEventListener("click", () => {
    if (userAddress) {
      // open block explorer for the current wallet
      window.open(explorerAddr(userAddress), "_blank");
    } else {
      connectWallet();
    }
  });

  // Reload state when account or chain changes.
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }

  // ---- Init ----
  renderBanners();
  if (cfg.address) {
    contractLink.href = explorerAddr(cfg.address);
  }
})();
