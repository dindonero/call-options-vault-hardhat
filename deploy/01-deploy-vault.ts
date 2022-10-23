import { HardhatRuntimeEnvironment } from "hardhat/types"
import {
    ETH_USD_PRICE_FEED_ADDRESS,
    UNISWAPV2_ROUTER_ADDRESS,
    WETH_ADDRESS,
} from "../helper-hardhat-config"
import { ethers } from "hardhat"
import { Vault } from "../typechain-types"

const deployVault = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log("----------------------------------------------------")
    await deploy("Vault", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            viaAdminContract: {
                name: "VaultProxyAdmin",
                artifact: "VaultProxyAdmin",
            },
        },
    })

    const underlyingAssetAddress = WETH_ADDRESS
    const exchangeAddress = UNISWAPV2_ROUTER_ADDRESS
    const startTime = 0
    const endTime = 20
    const bufferTime = 5
    const ethUsdPriceFeedAddress = ETH_USD_PRICE_FEED_ADDRESS

    const vault: Vault = await ethers.getContract("Vault")
    const initializeTx = await vault.initialize(
        underlyingAssetAddress,
        exchangeAddress,
        startTime,
        endTime,
        bufferTime,
        ethUsdPriceFeedAddress
    )
    await initializeTx.wait(1)

    log("----------------------------------------------------")
}

export default deployVault
deployVault.tags = ["all", "vault"]
