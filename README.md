# Simple Call Options Vault Hardhat

This project represents a simple call options vault smart contract that can be used to buy options or deposit assets. The contract is written in Solidity and deployed and tested using Hardhat with Typescript.

## Installation

1. Clone the repository and install the dependencies.
```bash
git clone https://github.com/dindonero/call-options-vault-hardhat.git
cd call-options-vault-hardhat
yarn install
npm install
```
2. Create a `.env` file in the root directory and add the following environment variables:
```bash
MAINNET_RPC_URL=
```

### Deploy the contract

```bash
npm deploy
```

### Run the tests
Note: The tests are designed to be run on a Ethereum Mainnet fork. 
```bash
npm test
```