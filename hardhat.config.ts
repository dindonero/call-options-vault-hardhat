import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-ethers"
import "dotenv/config"
import "hardhat-deploy"

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || ""

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.17",
            },
            {
                version: "0.5.16",
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            forking: {
                url: MAINNET_RPC_URL,
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        user1: {
            default: 1,
        },
        user2: {
            default: 2,
        },
    },
}

export default config
