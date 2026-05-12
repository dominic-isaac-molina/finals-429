window.CONTRACT_CONFIG = {
  "address": "0xF890CE42380b8a2361e770e9bBFd4687dCD3722d",
  "chainId": 80002,
  "network": "amoy",
  "serverAddress": "0x2bB31142b7d28CE1156450F9F9dbD34091b9531F",
  "abi": [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "string",
          "name": "documentId",
          "type": "string"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "fileHash",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "fileName",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "name": "DocumentRegistered",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "documentId",
          "type": "string"
        }
      ],
      "name": "exists",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "documentId",
          "type": "string"
        }
      ],
      "name": "getDocument",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "fileHash",
          "type": "bytes32"
        },
        {
          "internalType": "string",
          "name": "fileName",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "getDocumentCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "getDocumentIds",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "documentId",
          "type": "string"
        },
        {
          "internalType": "bytes32",
          "name": "fileHash",
          "type": "bytes32"
        },
        {
          "internalType": "string",
          "name": "fileName",
          "type": "string"
        }
      ],
      "name": "registerDocument",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
};
