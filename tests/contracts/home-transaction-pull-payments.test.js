const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction payout delivery regressions", () => {
  it("finalizes successfully even when a payout recipient rejects direct ETH transfers", async () => {
    const provider = createProvider();
    const [realtor, , buyer] = await getWallets(provider);

    const revertingSeller = await deployContract({
      fileName: "RevertingSeller.sol",
      contractName: "RevertingSeller",
      signer: realtor,
    });

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
        revertingSeller.address,
        await buyer.getAddress(),
      ],
    });

    await (await revertingSeller.connect(realtor).sign(contract.address)).wait();
    await (
      await contract
        .connect(buyer)
        .buyerSignContractAndPayDeposit({ value: ethers.BigNumber.from(10) })
    ).wait();
    await (await contract.connect(realtor).realtorReviewedClosingConditions(true)).wait();
    await (
      await contract
        .connect(buyer)
        .buyerFinalizeTransaction({ value: ethers.BigNumber.from(90) })
    ).wait();

    assert.strictEqual((await contract.contractState()).toString(), "4");
    assert.strictEqual(
      (await contract.pendingWithdrawals(revertingSeller.address)).toString(),
      "95"
    );
    assert.strictEqual(
      (await contract.pendingWithdrawals(await realtor.getAddress())).toString(),
      "5"
    );
  });
});
