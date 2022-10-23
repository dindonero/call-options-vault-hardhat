import { deployments, ethers } from "hardhat"

async function main(newContractAddress: string) {
    const { log } = deployments

    log("----------------------------------------------------")

    const vaultProxyAdmin = await ethers.getContract("VaultProxyAdmin")
    const transparentProxy = await ethers.getContract("Vault_Proxy")

    const upgradeTx = await vaultProxyAdmin.upgrade(transparentProxy.address, newContractAddress)
    await upgradeTx.wait(1)

    log("----------------------------------------------------")
}

export default main
