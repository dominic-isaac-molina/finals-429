// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentRegistry {
    struct Document {
        bytes32 fileHash;
        string fileName;
        address uploader;
        uint256 timestamp;
        string storagePointer;
        bool exists;
        bool deactivated;
    }

    mapping(string => Document) private documents;
    string[] private documentIds;

    event DocumentRegistered(
        string indexed documentId,
        bytes32 indexed fileHash,
        string fileName,
        address indexed uploader,
        uint256 timestamp,
        string storagePointer
    );

    event DocumentRemoved(string indexed documentId);

    function registerDocument(
        string calldata documentId,
        bytes32 fileHash,
        string calldata fileName,
        string calldata storagePointer
    ) external {
        require(
            !documents[documentId].exists || documents[documentId].deactivated,
            "Document already exists"
        );

        documents[documentId] = Document({
            fileHash: fileHash,
            fileName: fileName,
            uploader: msg.sender,
            timestamp: block.timestamp,
            storagePointer: storagePointer,
            exists: true,
            deactivated: false
        });
        documentIds.push(documentId);

        emit DocumentRegistered(
            documentId,
            fileHash,
            fileName,
            msg.sender,
            block.timestamp,
            storagePointer
        );
    }

    function deactivateDocument(string calldata documentId) external {
        Document storage document = documents[documentId];
        require(document.exists && !document.deactivated, "Document not found");
        document.deactivated = true;

        for (uint256 i = 0; i < documentIds.length; i++) {
            if (keccak256(bytes(documentIds[i])) == keccak256(bytes(documentId))) {
                documentIds[i] = documentIds[documentIds.length - 1];
                documentIds.pop();
                break;
            }
        }

        emit DocumentRemoved(documentId);
    }

    function getDocument(string calldata documentId) external view returns (
        string memory id,
        bytes32 fileHash,
        string memory fileName,
        address uploader,
        uint256 timestamp,
        string memory storagePointer
    ) {
        Document storage document = documents[documentId];
        require(document.exists && !document.deactivated, "Document not found");

        return (
            documentId,
            document.fileHash,
            document.fileName,
            document.uploader,
            document.timestamp,
            document.storagePointer
        );
    }

    function exists(string calldata documentId) external view returns (bool) {
        return documents[documentId].exists && !documents[documentId].deactivated;
    }

    function getDocumentIds() external view returns (string[] memory) {
        return documentIds;
    }

    function getDocumentCount() external view returns (uint256) {
        return documentIds.length;
    }
}
