const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets, mineBlocks } = require("./helpers/solidity");

describe("HomeTransaction finalization deadline regressions", () => {
  it("does not allow the buyer to finalize after the deadline has expired", async () => {
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
    await (await contract.connect(realtor).realtorReviewedClosingConditions(true)).wait();

    await provider.send("evm_increaseTime", [5 * 60 + 1]);
    await mineBlocks(provider, 26);

    await assert.rejects(
      contract
        .connect(buyer)
        .buyerFinalizeTransaction({ value: ethers.BigNumber.from(90) }),
      /deadline/i
    );
  });
});
