const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets, mineBlocks } = require("./helpers/solidity");

describe("HomeTransaction realtor-review timeout regressions", () => {
  it("lets the buyer recover the deposit if the realtor never reviews before the deadline", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);

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

    await (await contract.connect(seller).sellerSignContract()).wait();
    await (
      await contract
        .connect(buyer)
        .buyerSignContractAndPayDeposit({ value: ethers.BigNumber.from(10) })
    ).wait();

    assert.strictEqual((await provider.getBalance(contract.address)).toString(), "10");
    assert.strictEqual((await contract.contractState()).toString(), "2");

    await provider.send("evm_increaseTime", [5 * 60 + 1]);
    await mineBlocks(provider, 26);

    await (await contract.connect(buyer).anyWithdrawFromTransaction()).wait();

    assert.strictEqual((await contract.contractState()).toString(), "5");
    assert.strictEqual(
      (await contract.pendingWithdrawals(await buyer.getAddress())).toString(),
      "10"
    );

    await (await contract.connect(buyer).withdrawPayout()).wait();

    assert.strictEqual(
      (await contract.pendingWithdrawals(await buyer.getAddress())).toString(),
      "0"
    );
    assert.strictEqual((await provider.getBalance(contract.address)).toString(), "0");
  });
});
