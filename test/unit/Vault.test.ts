import { IERC20, IWETH9, Vault } from "../../typechain-types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { deployments, ethers } from "hardhat"
import { assert, expect } from "chai"
import getUsdcAndWeth from "../../scripts/get-usdc-and-weth"
import { USDC_ADDRESS, WETH_ADDRESS } from "../../helper-hardhat-config"

describe("Vault Unit Tests", function () {
    let vault: Vault,
        vault_user1: Vault,
        vault_user2: Vault,
        deployer: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress
    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]

        await deployments.fixture("all")

        vault = await ethers.getContract("Vault", deployer)
        vault_user1 = await ethers.getContract("Vault", user1)
        vault_user2 = await ethers.getContract("Vault", user2)

        await getUsdcAndWeth(deployer)
        await getUsdcAndWeth(user1)
        await getUsdcAndWeth(user2)
    })
    it("is contract deployed", async function () {
        assert.notEqual(vault.address, undefined)
    })

    describe("buy option", function () {
        it("emits a OptionBought event after a buy", async () => {
            await expect(await vault_user1.buyOption(100, 10000)).to.emit(
                vault_user1,
                "OptionBought"
            )
        })
        it("reverts if the price is less than the limit price", async () => {
            await expect(vault.buyOption(100, 10)).to.be.revertedWith("Vault__PriceTooLow()")
        })
        it("only owner is able to change limit price", async () => {
            await expect(vault_user2.setLimitPrice(100)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            )
        })
        it("option is created with correct values", async () => {
            let optionId: number
            const amount = 100
            const price = 2000
            const tx = await vault_user1.buyOption(amount, price)
            const receipt = await tx.wait(1)

            receipt.events
                ?.filter((event) => event.event === "OptionBought")
                .forEach((event) => {
                    optionId = event.args?.optionId.toNumber()
                })

            const option = await vault_user1.getOption(optionId)
            assert.equal(option.amount.toNumber(), amount)
            assert.equal(option.strikePrice.toNumber(), price)
            assert.equal(option.owner.toString(), user1.address.toString())
        })
    })

    describe("deposit", function () {
        it("emits a Deposit event after a deposit", async () => {
            await expect(await vault_user1.depositAssets(ethers.utils.parseEther("1"))).to.emit(
                vault_user1,
                "Deposit"
            )
        })
        it("reverts if the amount is 0", async () => {
            await expect(vault_user1.depositAssets(0)).to.be.revertedWith(
                "Vault__DepositAmountMustBeAboveZero()"
            )
        })
        it("successful deposit increases the user's balance", async () => {
            const userBalance = await vault_user1.balances(user1.address)
            const amount = ethers.utils.parseEther("1")
            await vault_user1.depositAssets(amount)
            const userBalanceAfter = await vault_user1.balances(user1.address)
            assert(userBalanceAfter.gt(userBalance))
        })
    })

    describe("withdraw", function () {
        let amount = ethers.utils.parseEther("1")
        beforeEach(async () => {
            await vault_user1.depositAssets(amount)
            const startTime = await vault_user1.START_TIME()
            const endTime = await vault_user1.END_TIME()
            await new Promise((resolve) =>
                setTimeout(resolve, (endTime.toNumber() - startTime.toNumber()) * 1000)
            )
        })
        it("emits a Withdraw event after a withdraw", async () => {
            await expect(await vault_user1.withdrawAssets()).to.emit(vault_user1, "Withdraw")
        })
        it("successful withdraw decreases the user's balance", async () => {
            const userBalanceInVault = await vault_user1.balances(user1.address)

            const weth: IWETH9 = await ethers.getContractAt("IWETH9", WETH_ADDRESS)
            const wethBalanceBefore = await weth.balanceOf(user1.address)

            await vault_user1.withdrawAssets()
            const userBalanceInVaultAfter = await vault_user1.balances(user1.address)
            const wethBalanceAfter = await weth.balanceOf(user1.address)
            assert(userBalanceInVaultAfter.lt(userBalanceInVault))
            assert.equal(wethBalanceAfter.sub(amount).toString(), wethBalanceBefore.toString())
        })
    })

    describe("example1", function () {
        const amountUser1 = ethers.utils.parseEther("1")
        const amountUser2 = ethers.utils.parseEther("4")
        const expectedEthAmountToReceiveUser1 = ethers.utils.parseEther("1.2")
        const expectedEthAmountToReceiveUser2 = ethers.utils.parseEther("4.8")
        const expectedUsdcAmountToReceiveUser1 = 20 // for simplicity let's assume usdc has no decimals
        const expectedUsdcAmountToReceiveUser2 = 80
        it("2 users deposit 5 weth and withdraw after end time the vault has 6 weth and 100 usdc", async () => {
            await vault_user1.depositAssets(amountUser1)
            await vault_user2.depositAssets(amountUser2)
            const startTime = await vault_user1.START_TIME()
            const endTime = await vault_user1.END_TIME()

            const weth: IWETH9 = await ethers.getContractAt("IWETH9", WETH_ADDRESS, deployer)
            const usdc: IERC20 = await ethers.getContractAt(
                "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                USDC_ADDRESS
            )

            // Fake increase in WETH and USDC
            await weth.transfer(vault.address, ethers.utils.parseEther("1"))
            await usdc.transfer(vault.address, 100)

            await new Promise((resolve) =>
                setTimeout(resolve, (endTime.toNumber() - startTime.toNumber()) * 1000)
            )

            const wethBalanceBeforeUser1 = await weth.balanceOf(user1.address)
            const wethBalanceBeforeUser2 = await weth.balanceOf(user2.address)
            const usdcBalanceBeforeUser1 = await usdc.balanceOf(user1.address)
            const usdcBalanceBeforeUser2 = await usdc.balanceOf(user2.address)

            await vault_user1.withdrawAssets()
            await vault_user2.withdrawAssets()

            const wethBalanceAfterUser1 = await weth.balanceOf(user1.address)
            const wethBalanceAfterUser2 = await weth.balanceOf(user2.address)
            const usdcBalanceAfterUser1 = await usdc.balanceOf(user1.address)
            const usdcBalanceAfterUser2 = await usdc.balanceOf(user2.address)

            assert.equal(
                wethBalanceAfterUser1.sub(wethBalanceBeforeUser1).toString(),
                expectedEthAmountToReceiveUser1.toString()
            )
            assert.equal(
                wethBalanceAfterUser2.sub(wethBalanceBeforeUser2).toString(),
                expectedEthAmountToReceiveUser2.toString()
            )
            assert.equal(
                usdcBalanceAfterUser1.sub(usdcBalanceBeforeUser1).toString(),
                expectedUsdcAmountToReceiveUser1.toString()
            )
            assert.equal(
                usdcBalanceAfterUser2.sub(usdcBalanceBeforeUser2).toString(),
                expectedUsdcAmountToReceiveUser2.toString()
            )
        })
    })
})
