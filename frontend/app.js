(() => {
  "use strict";

  const cfg = window.CONTRACT_CONFIG || {};
  const PUBLIC_RPC = cfg.network === "localhost"
    ? "http://127.0.0.1:8545"
    : "https://rpc-amoy.polygon.technology";

  const banners      = document.getElementById("setup-banners");
  const registerForm = document.getElementById("register-form");
  const registerBtn  = document.getElementById("register-btn");
  const verifyForm   = document.getElementById("verify-form");
  const verifyBtn    = document.getElementById("verify-btn");
  const verifySelect = document.getElementById("verify-id");
  const docsBody     = document.getElementById("docs-body");
  const toastEl      = document.getElementById("toast");
  const contractLink = document.getElementById("contract-link");
  const ownerLabel   = document.getElementById("owner-label");
  const clearDemoBtn = document.getElementById("clear-demo-btn");
  const fileInput    = document.getElementById("register-file");
  const filePreview  = document.getElementById("file-preview");
  const previewImg   = document.getElementById("preview-img");
  const previewName  = document.getElementById("preview-name");

  let provider = null;
  let contractRead = null;
  let serverAddress = null;
  let demoMode = false;
  const DEMO_STORAGE_KEY = "document-registry-demo-docs";
  const DEMO_LEDGER_KEY = "document-registry-demo-ledger";

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
  function toast(msg, kind, opts) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = "toast " + (kind || "");
    toastEl.style.display = "block";
    toastEl.style.cursor = (opts && opts.onClick) ? "pointer" : "default";
    toastEl.onclick = (opts && opts.onClick) || null;
    toastTimer = setTimeout(() => { toastEl.style.display = "none"; }, 4500);
  }

  function setBanner(html) { banners.innerHTML = html || ""; }

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
    return cfg.network === "localhost" ? "#" : `https://amoy.polygonscan.com/tx/${txHash}`;
  }

  function explorerAddr(addr) {
    return cfg.network === "localhost" ? "#" : `https://amoy.polygonscan.com/address/${addr}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function loadDemoEvents() {
    try {
      const ledgerRaw = localStorage.getItem(DEMO_LEDGER_KEY);
      const ledger = ledgerRaw ? JSON.parse(ledgerRaw) : [];
      if (Array.isArray(ledger) && ledger.length) return ledger;

      const oldRaw = localStorage.getItem(DEMO_STORAGE_KEY);
      const oldDocs = oldRaw ? JSON.parse(oldRaw) : [];
      if (!Array.isArray(oldDocs) || !oldDocs.length) return [];

      const migrated = oldDocs.map(doc => ({
        type: "registered",
        id: doc.id,
        fileHash: doc.fileHash,
        fileName: doc.fileName,
        ts: doc.ts || Math.floor(Date.now() / 1000)
      }));
      localStorage.setItem(DEMO_LEDGER_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return [];
    }
  }

  function appendDemoEvent(event) {
    const ledger = loadDemoEvents();
    ledger.push(event);
    localStorage.setItem(DEMO_LEDGER_KEY, JSON.stringify(ledger));
  }

  function loadDemoDocs() {
    const docs = new Map();
    for (const event of loadDemoEvents()) {
      if (event.type === "registered" && !docs.has(event.id)) {
        docs.set(event.id, {
          id: event.id,
          fileHash: event.fileHash,
          fileName: event.fileName,
          ts: event.ts
        });
      }
    }
    return Array.from(docs.values());
  }

  function getDemoDoc(documentId) {
    return loadDemoDocs().find(doc => doc.id === documentId);
  }

  async function bootstrap() {
    if (!cfg.address) {
      demoMode = true;
      setBanner(`
        <div class="banner warn">
          <b>Demo mode.</b>
          <p>This hosted version saves fingerprints in this browser so it can be
          tested for free. Deploying a contract later switches it to on-chain storage.</p>
        </div>
      `);
      if (contractLink) contractLink.href = "#";
      if (ownerLabel) {
        ownerLabel.textContent = "this browser";
        ownerLabel.removeAttribute("href");
      }
      if (clearDemoBtn) clearDemoBtn.style.display = "inline";
      await refreshDocs();
      return;
    }

    provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
    contractRead = new ethers.Contract(cfg.address, cfg.abi, provider);
    contractLink.href = explorerAddr(cfg.address);

    try {
      const res = await fetch("/api/info");
      if (!res.ok) throw new Error("no api");
      const info = await res.json();
      serverAddress = info.serverAddress;
    } catch {
      serverAddress = cfg.serverAddress || null;
    }

    if (!serverAddress) {
      setBanner(`
        <div class="banner warn">
          <b>Server signer not configured.</b>
          <p>Run <code>vercel dev</code> (or deploy to Vercel) so the
          <code>/api</code> endpoints have a wallet to sign with. Set
          <code>PRIVATE_KEY</code> in your Vercel project's Environment Variables.</p>
        </div>
      `);
    } else if (ownerLabel) {
      ownerLabel.textContent = shortAddr(serverAddress);
      ownerLabel.href = explorerAddr(serverAddress);
    }

    await refreshDocs();
  }

  async function refreshDocs() {
    if (demoMode) {
      const items = loadDemoDocs().sort((a, b) => b.ts - a.ts);
      renderDocs(items);
      renderVerifyOptions(items);
      return;
    }

    if (!contractRead || !serverAddress) {
      docsBody.innerHTML = '<tr><td colspan="5" class="empty">Waiting on configuration…</td></tr>';
      return;
    }
    try {
      const ids = await contractRead.getDocumentIds(serverAddress);
      const items = [];
      for (const id of ids) {
        const [fileHash, fileName, ts] = await contractRead.getDocument(serverAddress, id);
        items.push({ id, fileHash, fileName, ts: Number(ts) });
      }
      items.sort((a, b) => b.ts - a.ts);
      renderDocs(items);
      renderVerifyOptions(items);
    } catch (err) {
      console.error(err);
      docsBody.innerHTML = `<tr><td colspan="5" class="empty">Couldn't load documents: ${escapeHtml(err.shortMessage || err.message)}</td></tr>`;
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
            <span class="mono">Permanent</span>
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

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file  = document.getElementById("register-file").files[0];
    const docId = document.getElementById("register-id").value.trim();
    if (!file || !docId) return toast("Pick a file and an ID.", "error");

    try {
      registerBtn.disabled = true;
      registerBtn.textContent = "Hashing…";
      const fileHash = await hashFile(file);

      registerBtn.textContent = "Submitting…";
      if (demoMode) {
        const docs = loadDemoDocs();
        if (docs.some(doc => doc.id === docId)) {
          throw new Error("That document ID is already in use. Pick another.");
        }
        appendDemoEvent({
          type: "registered",
          id: docId,
          fileHash,
          fileName: file.name,
          ts: Math.floor(Date.now() / 1000)
        });
        toast(`Registered "${docId}".`, "success");
      } else {
        const data = await postJson("/api/register", {
          documentId: docId,
          fileHash,
          fileName: file.name
        });

        toast(`Registered "${docId}". View transaction →`, "success", {
          onClick: cfg.network === "localhost" ? null : () => window.open(explorerTx(data.txHash), "_blank")
        });
      }

      registerForm.reset();
      filePreview.style.display = "none";
      await refreshDocs();
    } catch (err) {
      toast(err.message || "Register failed.", "error");
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = "Register on-chain";
    }
  });

  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!demoMode && (!contractRead || !serverAddress)) return toast("App isn't ready yet.", "error");
    const docId = verifySelect.value;
    const file = document.getElementById("verify-file").files[0];
    if (!docId || !file) return toast("Pick a document and a file.", "error");

    try {
      verifyBtn.disabled = true;
      verifyBtn.textContent = "Checking…";
      const expected = demoMode
        ? getDemoDoc(docId)?.fileHash
        : (await contractRead.getDocument(serverAddress, docId))[0];
      if (!expected) throw new Error("Document not found.");
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
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) { filePreview.style.display = "none"; return; }
    previewName.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    if (file.type.startsWith("image/")) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
    } else {
      previewImg.style.display = "none";
    }
    filePreview.style.display = "block";
  });

  if (clearDemoBtn) {
    clearDemoBtn.addEventListener("click", () => {
      if (!confirm("Clear all demo data? This can't be undone.")) return;
      localStorage.removeItem(DEMO_LEDGER_KEY);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      refreshDocs();
      toast("Demo data cleared.", "success");
    });
  }

  bootstrap();
})();
