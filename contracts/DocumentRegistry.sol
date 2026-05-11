// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title DocumentRegistry
/// @notice Stores SHA-256 hashes of documents per uploader. The original files
///         are never sent on-chain; only their hash, file name, and timestamp.
///         Each wallet address keeps its own namespace of document IDs, so the
///         same contract can be shared by many users without collisions.
contract DocumentRegistry {
    struct Document {
        bytes32 fileHash;
        string fileName;
        uint256 timestamp;
        bool exists;
        bool deactivated;
    }

    // owner => documentId => Document
    mapping(address => mapping(string => Document)) private documents;
    // owner => list of their active document IDs
    mapping(address => string[]) private ownerIds;

    event DocumentRegistered(
        address indexed owner,
        string indexed documentId,
        bytes32 indexed fileHash,
        string fileName,
        uint256 timestamp
    );

    event DocumentRemoved(address indexed owner, string indexed documentId);

    function registerDocument(
        string calldata documentId,
        bytes32 fileHash,
        string calldata fileName
    ) external {
        Document storage existing = documents[msg.sender][documentId];
        require(!existing.exists || existing.deactivated, "Document already exists");

        documents[msg.sender][documentId] = Document({
            fileHash: fileHash,
            fileName: fileName,
            timestamp: block.timestamp,
            exists: true,
            deactivated: false
        });

        // Add to the owner's list. Reusing a deactivated slot also re-adds it
        // since deactivateDocument removed it from the list.
        ownerIds[msg.sender].push(documentId);

        emit DocumentRegistered(
            msg.sender,
            documentId,
            fileHash,
            fileName,
            block.timestamp
        );
    }

    function deactivateDocument(string calldata documentId) external {
        Document storage document = documents[msg.sender][documentId];
        require(document.exists && !document.deactivated, "Document not found");
        document.deactivated = true;

        string[] storage ids = ownerIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            if (keccak256(bytes(ids[i])) == keccak256(bytes(documentId))) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }

        emit DocumentRemoved(msg.sender, documentId);
    }

    function getDocument(address owner, string calldata documentId)
        external
        view
        returns (bytes32 fileHash, string memory fileName, uint256 timestamp)
    {
        Document storage document = documents[owner][documentId];
        require(document.exists && !document.deactivated, "Document not found");
        return (document.fileHash, document.fileName, document.timestamp);
    }

    function exists(address owner, string calldata documentId) external view returns (bool) {
        Document storage document = documents[owner][documentId];
        return document.exists && !document.deactivated;
    }

    function getDocumentIds(address owner) external view returns (string[] memory) {
        return ownerIds[owner];
    }

    function getDocumentCount(address owner) external view returns (uint256) {
        return ownerIds[owner].length;
    }
}
