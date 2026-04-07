pragma solidity >=0.4.25 <0.6.0;

interface IHomeTransactionSeller {
    function sellerSignContract() external;
    function withdrawPayoutTo(address payable recipient) external;
}

contract RevertingSeller {
    function sign(address transactionAddress) external {
        IHomeTransactionSeller(transactionAddress).sellerSignContract();
    }

    function withdrawTo(address transactionAddress, address payable recipient) external {
        IHomeTransactionSeller(transactionAddress).withdrawPayoutTo(recipient);
    }

    function() external payable {
        revert("seller refuses direct payments");
    }
}
