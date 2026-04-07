const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction buyer cancel regressions", () => {
  it("does not allow the buyer to cancel for free while realtor review is still pending", async () => {
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

    await assert.rejects(
      contract.connect(buyer).anyWithdrawFromTransaction(),
      /pending review before deadline/i
    );

    assert.strictEqual((await contract.contractState()).toString(), "2");
    assert.strictEqual(
      (await contract.pendingWithdrawals(await buyer.getAddress())).toString(),
      "0"
    );
  });
});
