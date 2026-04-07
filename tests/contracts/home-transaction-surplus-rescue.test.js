const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction surplus ether rescue regressions", () => {
  it("rescues forced ether without consuming tracked participant payouts", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer, recipient] = await getWallets(provider);

    const contract = await deployContract({
      fileName: "HomeTransaction.sol",
      contractName: "HomeTransaction",
      signer: realtor,
      args: [
        "123 Main St",
        "94105",
        "San Francisco",
        5,
        100,
        await realtor.getAddress(),
        await seller.getAddress(),
        await buyer.getAddress(),
      ],
    });

    const forceEther = await deployContract({
      fileName: "ForceEther.sol",
      contractName: "ForceEther",
      signer: realtor,
      args: [],
      overrides: { value: ethers.BigNumber.from(7) },
    });

    await (await contract.connect(seller).sellerSignContract()).wait();
    await (
      await contract
        .connect(buyer)
        .buyerSignContractAndPayDeposit({ value: ethers.BigNumber.from(10) })
    ).wait();
    await (await contract.connect(realtor).realtorReviewedClosingConditions(false)).wait();

    await (await forceEther.connect(realtor).destroyAndSend(contract.address)).wait();

    const recipientAddress = await recipient.getAddress();
    const balanceBefore = await provider.getBalance(recipientAddress);

    await (await contract.connect(realtor).rescueSurplusEther(recipientAddress)).wait();

    const balanceAfter = await provider.getBalance(recipientAddress);
    assert.ok(balanceAfter.sub(balanceBefore).eq(ethers.BigNumber.from(7)));
    assert.strictEqual((await contract.pendingWithdrawals(await buyer.getAddress())).toString(), "10");
    assert.strictEqual((await provider.getBalance(contract.address)).toString(), "10");
  });
});
