const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction payout recipient escape hatch regressions", () => {
  it("lets a reverting payout recipient redirect its withdrawal to a safe address", async () => {
    const provider = createProvider();
    const [realtor, fallbackRecipient, buyer] = await getWallets(provider);

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

    const fallbackAddress = await fallbackRecipient.getAddress();

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

    await assert.rejects(
      revertingSeller.connect(realtor).sign(contract.address),
      /wrong contract state/i
    );

    const balanceBefore = await provider.getBalance(fallbackAddress);
    const withdrawReceipt = await (
      await revertingSeller.connect(realtor).withdrawTo(contract.address, fallbackAddress)
    ).wait();
    const balanceAfter = await provider.getBalance(fallbackAddress);

    assert.strictEqual(
      (await contract.pendingWithdrawals(revertingSeller.address)).toString(),
      "0"
    );
    assert.ok(balanceAfter.sub(balanceBefore).eq(ethers.BigNumber.from(95)));
    const payoutEvents = await contract.queryFilter(
      contract.filters.PayoutWithdrawn(),
      withdrawReceipt.blockNumber,
      withdrawReceipt.blockNumber
    );
    assert.ok(
      payoutEvents.some(
        (event) =>
          String(event.args.owner).toLowerCase() === revertingSeller.address.toLowerCase() &&
          String(event.args.recipient).toLowerCase() === fallbackAddress.toLowerCase() &&
          event.args.amount.toString() === "95"
      )
    );
  });
});
