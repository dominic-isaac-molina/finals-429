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
