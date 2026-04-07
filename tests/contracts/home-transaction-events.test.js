const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction event emission regressions", () => {
  it("emits lifecycle and payout events for the critical transaction flow", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);
    const realtorAddress = await realtor.getAddress();
    const sellerAddress = await seller.getAddress();
    const buyerAddress = await buyer.getAddress();

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
        realtorAddress,
        sellerAddress,
        buyerAddress,
      ],
    });

    const sellerReceipt = await (await contract.connect(seller).sellerSignContract()).wait();
    assert.ok(sellerReceipt.events.some((event) => event.event === "SellerSigned"));

    const depositReceipt = await (
      await contract
        .connect(buyer)
        .buyerSignContractAndPayDeposit({ value: ethers.BigNumber.from(10) })
    ).wait();
    assert.ok(
      depositReceipt.events.some(
        (event) => event.event === "BuyerSignedAndDeposited" && event.args.amount.toString() === "10"
      )
    );

    const reviewReceipt = await (
      await contract.connect(realtor).realtorReviewedClosingConditions(true)
    ).wait();
    assert.ok(
      reviewReceipt.events.some(
        (event) => event.event === "ClosingConditionsReviewed" && event.args.accepted === true
      )
    );

    const finalizeReceipt = await (
      await contract.connect(buyer).buyerFinalizeTransaction({ value: ethers.BigNumber.from(90) })
    ).wait();
    assert.ok(finalizeReceipt.events.some((event) => event.event === "TransactionFinalized"));
    assert.ok(
      finalizeReceipt.events.some(
        (event) =>
          event.event === "PayoutCredited" &&
          event.args.recipient === sellerAddress &&
          event.args.amount.toString() === "95"
      )
    );
    assert.ok(
      finalizeReceipt.events.some(
        (event) =>
          event.event === "PayoutCredited" &&
          event.args.recipient === realtorAddress &&
          event.args.amount.toString() === "5"
      )
    );

    const withdrawReceipt = await (await contract.connect(realtor).withdrawPayout()).wait();
    assert.ok(
      withdrawReceipt.events.some(
        (event) =>
          event.event === "PayoutWithdrawn" &&
          event.args.recipient === realtorAddress &&
          event.args.amount.toString() === "5"
      )
    );
  });
});
