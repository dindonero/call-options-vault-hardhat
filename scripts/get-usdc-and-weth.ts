import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { UNISWAPV2_ROUTER_ADDRESS, USDC_ADDRESS, WETH_ADDRESS } from "../helper-hardhat-config"
import { IERC20, IUniswapV2Router01, IWETH9 } from "../typechain-types"
import { ethers } from "hardhat"

const getUsdcAndWeth = async (account: SignerWithAddress) => {
    const { deployments, ethers } = require("hardhat")
    const { log } = deployments

    // Depositing ETH for WETH

    const wethContract: IWETH9 = await ethers.getContractAt("IWETH9", WETH_ADDRESS, account)

    const depositTx = await wethContract.deposit({ value: ethers.utils.parseEther("10") })

    await depositTx.wait(1)

    log("----------------------------------------------------")

    // Swapping ETH for USDC

    const uniswapV2: IUniswapV2Router01 = await ethers.getContractAt(
        "IUniswapV2Router01",
        UNISWAPV2_ROUTER_ADDRESS,
        account
    )

    const swapTx = await uniswapV2.swapExactETHForTokens(
        0,
        [WETH_ADDRESS, USDC_ADDRESS],
        account.address,
        Date.now() + 1000,
        { value: ethers.utils.parseEther("10") }
    )

    await swapTx.wait(1)

    log("----------------------------------------------------")

    // Approving the vault to spend the USDC and WETH

    const usdcContract: IERC20 = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        USDC_ADDRESS,
        account
    )

    const vault = await ethers.getContract("Vault")

    const approveWETHTx = await wethContract.approve(vault.address, ethers.constants.MaxUint256)

    await approveWETHTx.wait(1)

    const approveUSDCtx = await usdcContract.approve(vault.address, ethers.constants.MaxUint256)

    await approveUSDCtx.wait(1)
}

export default getUsdcAndWeth
