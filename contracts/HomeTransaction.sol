pragma solidity >=0.4.25 <0.6.0;

contract HomeTransaction {
    // Constants
    uint constant timeBetweenDepositAndFinalization = 5 minutes;
    uint constant depositPercentage = 10;
    mapping(address => uint) public pendingWithdrawals;

    enum ContractState {
        WaitingSellerSignature,
        WaitingBuyerSignature,
        WaitingRealtorReview,
        WaitingFinalization,
        Finalized,
        Rejected }
    ContractState public contractState = ContractState.WaitingSellerSignature;


    // Roles acting on contract
    address payable public realtor;
    address payable public seller;
    address payable public buyer;

    // Contract details
    string public homeAddress;
    string public zip;
    string public city;
    uint public realtorFee;
    uint public price;

    // Set when buyer signs and pays deposit
    uint public deposit;
    uint public finalizeDeadline;

    // Set when realtor reviews closing conditions
    enum ClosingConditionsReview { Pending, Accepted, Rejected }
    ClosingConditionsReview closingConditionsReview = ClosingConditionsReview.Pending;

    constructor(
        string memory _address,
        string memory _zip,
        string memory _city,
        uint _realtorFee,
        uint _price,
        address payable _realtor,
        address payable _seller,
        address payable _buyer) public {
        require(_price >= _realtorFee, "Price needs to be more than realtor fee!");
        require(_price * depositPercentage / 100 >= _realtorFee, "Minimum buyer deposit must cover realtor fee");

        realtor = _realtor;
        seller = _seller;
        buyer = _buyer;
        homeAddress = _address;
        zip = _zip;
        city = _city;
        price = _price;
        realtorFee = _realtorFee;
    }

    function sellerSignContract() public payable {
        require(seller == msg.sender, "Only seller can sign contract");

        require(contractState == ContractState.WaitingSellerSignature, "Wrong contract state");

        contractState = ContractState.WaitingBuyerSignature;
    }

    function buyerSignContractAndPayDeposit() public payable {
        require(buyer == msg.sender, "Only buyer can sign contract");

        require(contractState == ContractState.WaitingBuyerSignature, "Wrong contract state");

        require(msg.value >= price*depositPercentage/100 && msg.value <= price, "Buyer needs to deposit between 10% and 100% to sign contract");

        contractState = ContractState.WaitingRealtorReview;

        deposit = msg.value;
        finalizeDeadline = now + timeBetweenDepositAndFinalization;
    }

    function realtorReviewedClosingConditions(bool accepted) public {
        require(realtor == msg.sender, "Only realtor can review closing conditions");

        require(contractState == ContractState.WaitingRealtorReview, "Wrong contract state");

        if (accepted) {
            closingConditionsReview = ClosingConditionsReview.Accepted;
            contractState = ContractState.WaitingFinalization;
        } else {
            closingConditionsReview = ClosingConditionsReview.Rejected;
            contractState = ContractState.Rejected;

            _creditPayout(buyer, deposit);
        }
    }

    function buyerFinalizeTransaction() public payable {
        require(buyer == msg.sender, "Only buyer can finalize transaction");

        require(contractState == ContractState.WaitingFinalization, "Wrong contract state");
        require(now <= finalizeDeadline, "Finalization deadline has expired");

        require(msg.value + deposit == price, "Buyer needs to pay the rest of the cost to finalize transaction");

        contractState = ContractState.Finalized;

        _creditPayout(seller, price-realtorFee);
        _creditPayout(realtor, realtorFee);
    }

    function anyWithdrawFromTransaction() public {
        require(buyer == msg.sender || finalizeDeadline <= now, "Only buyer can withdraw before transaction deadline");

        require(
            contractState == ContractState.WaitingFinalization || contractState == ContractState.WaitingRealtorReview,
            "Wrong contract state"
        );

        contractState = ContractState.Rejected;

        if (closingConditionsReview == ClosingConditionsReview.Pending) {
            _creditPayout(buyer, deposit);
        } else {
            _creditPayout(seller, deposit-realtorFee);
            _creditPayout(realtor, realtorFee);
        }
    }

    function withdrawPayout() public {
        uint amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No payout available");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Withdrawal failed");
    }

    function _creditPayout(address payable recipient, uint amount) internal {
        pendingWithdrawals[recipient] += amount;
    }
}
