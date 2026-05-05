# Tamper-Proof Document Verification Demo

This final-project demo stores files in a local backend folder and stores only each file hash on a local Hardhat blockchain.

The important idea is simple: if the file changes, its SHA-256 hash changes. The backend compares the current file hash with the hash saved in the Solidity contract.

## Architecture

- Solidity: `contracts/DocumentRegistry.sol`
- Backend: `backend/server.js`
- Local file storage: `uploads/`
- Blockchain data: document ID, file hash, file name, uploader, timestamp, storage pointer

## API

- `POST /documents/upload` with multipart field `file`, optional `documentId`
- `GET /documents`
- `GET /documents/:id/download`
- `POST /documents/:id/verify` with optional multipart field `file`
- `DELETE /documents/:id` removes a mistaken upload from the active list

## Verification Behavior

The app verifies documents by comparing SHA-256 hashes, not file sizes.

On upload, the backend hashes the uploaded file bytes and stores that hash in the Solidity contract. On verify, the backend hashes either:

- a new file supplied by the user, or
- the already-stored local file when no comparison file is supplied.

The user-supplied file flow is the important demo: it proves whether a file someone has now matches the original registered hash. The stored-file flow is only a local integrity check. It should usually pass because it is checking the backend's saved copy against the hash that was created from that same saved copy. It only fails if the stored local file was edited, corrupted, deleted, or replaced outside the normal app flow.

This project currently has no user accounts or real authentication. Do not require a password to view a hash unless an account/authentication feature is added first. A frontend-only password prompt is not secure access control because there is no backend password validation and the hash is already available through the document API.

## Frontend Handoff Notes

Organize document actions around what each action actually does:

- Primary verification: `Verify Your File` or `Compare File to Blockchain Hash`. This should ask the user to choose a file and compare its SHA-256 hash to the stored on-chain hash.
- Stored copy check: rename `Verify Stored File` to `Check Stored Copy` or `Audit Stored Copy`. This makes clear that it checks the backend's saved file, so a passing result is expected unless the local stored file was tampered with.
- Hash visibility: rename `Show Full Hash` to `View Hash` or `Copy Hash`. Do not gate it behind a password in this version.
- Download: keep as `Download`.
- Removal: rename `Remove from Active List` to `Remove Record` or `Archive Record`, with a confirmation because it marks the blockchain record inactive and removes the local saved file.

Suggested action order in each document row:

1. `Verify Your File`
2. `Download`
3. `View Hash` or `Copy Hash`
4. `Check Stored Copy`
5. `Remove Record`

## Local Demo

Install dependencies:

```bash
npm install
```

**Terminal 1** - run the local Hardhat chain:

```bash
npm run node
```

**Terminal 2** - deploy the contract, then start the backend + frontend:

```bash
npm run deploy:localhost
npm start
```

Open the frontend at **http://localhost:3001** in your browser.

The backend API is also available directly at `http://localhost:3001/documents/...`.

## Tests

```bash
npm test
```

The test suite covers Solidity registration behavior, overwrite prevention, metadata retrieval, event emission, remove behavior, backend hashing/storage, verification success/failure, missing IDs, and the final tamper demo flow.
