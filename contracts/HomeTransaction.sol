pragma solidity >=0.4.25 <0.6.0;

library SafeMath {
    function add(uint a, uint b) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint a, uint b) internal pure returns (uint) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint a, uint b) internal pure returns (uint) {
        if (a == 0) {
            return 0;
        }

        uint c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint a, uint b) internal pure returns (uint) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}

contract HomeTransaction {
    using SafeMath for uint;

    event TransactionCreated(address indexed realtor, address indexed seller, address indexed buyer, uint price, uint realtorFee);
    event SellerSigned(address indexed seller);
    event BuyerSignedAndDeposited(address indexed buyer, uint amount, uint finalizeDeadline);
    event ClosingConditionsReviewed(address indexed realtor, bool accepted);
    event TransactionFinalized(address indexed buyer, uint totalPrice);
    event TransactionRejected(address indexed triggeredBy, string reason);
    event PayoutCredited(address indexed recipient, uint amount);
    event PayoutWithdrawn(address indexed recipient, uint amount);
    event SurplusEtherRescued(address indexed operator, address indexed recipient, uint amount);

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
        require(_realtor != address(0) && _seller != address(0) && _buyer != address(0), "Role address cannot be zero");
        // Each privileged actor needs an independent role to avoid self-dealing and broken settlement flows.
        require(_realtor != _seller && _realtor != _buyer && _seller != _buyer, "Roles must be distinct");
        require(_price >= _realtorFee, "Price needs to be more than realtor fee!");
        // Use checked arithmetic because this contract still targets Solidity 0.5.x.
        require(
            _price.mul(depositPercentage).div(100) >= _realtorFee,
            "Minimum buyer deposit must cover realtor fee"
        );

        realtor = _realtor;
        seller = _seller;
        buyer = _buyer;
        homeAddress = _address;
        zip = _zip;
        city = _city;
        price = _price;
        realtorFee = _realtorFee;

        emit TransactionCreated(realtor, seller, buyer, price, realtorFee);
    }

    function sellerSignContract() public {
        require(seller == msg.sender, "Only seller can sign contract");

        require(contractState == ContractState.WaitingSellerSignature, "Wrong contract state");

        contractState = ContractState.WaitingBuyerSignature;

        emit SellerSigned(msg.sender);
    }

    function buyerSignContractAndPayDeposit() public payable {
        require(buyer == msg.sender, "Only buyer can sign contract");

        require(contractState == ContractState.WaitingBuyerSignature, "Wrong contract state");

        require(
            msg.value >= price.mul(depositPercentage).div(100) && msg.value <= price,
            "Buyer needs to deposit between 10% and 100% to sign contract"
        );

        contractState = ContractState.WaitingRealtorReview;

        deposit = msg.value;
        finalizeDeadline = now.add(timeBetweenDepositAndFinalization);

        emit BuyerSignedAndDeposited(msg.sender, msg.value, finalizeDeadline);
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
            emit TransactionRejected(msg.sender, "closing conditions rejected");
        }

        emit ClosingConditionsReviewed(msg.sender, accepted);
    }

    function buyerFinalizeTransaction() public payable {
        require(buyer == msg.sender, "Only buyer can finalize transaction");

        require(contractState == ContractState.WaitingFinalization, "Wrong contract state");
        require(now <= finalizeDeadline, "Finalization deadline has expired");

        require(msg.value.add(deposit) == price, "Buyer needs to pay the rest of the cost to finalize transaction");

        contractState = ContractState.Finalized;

        _creditPayout(seller, price-realtorFee);
        _creditPayout(realtor, realtorFee);

        emit TransactionFinalized(msg.sender, price);
    }

    function anyWithdrawFromTransaction() public {
        require(
            buyer == msg.sender || seller == msg.sender || realtor == msg.sender,
            "Only a transaction participant can trigger withdrawal"
        );
        require(buyer == msg.sender || finalizeDeadline <= now, "Only buyer can withdraw before transaction deadline");

        require(
            contractState == ContractState.WaitingFinalization || contractState == ContractState.WaitingRealtorReview,
            "Wrong contract state"
        );

        contractState = ContractState.Rejected;

        if (closingConditionsReview == ClosingConditionsReview.Pending) {
            _creditPayout(buyer, deposit);
            emit TransactionRejected(msg.sender, "review deadline expired");
        } else {
            _creditPayout(seller, deposit.sub(realtorFee));
            _creditPayout(realtor, realtorFee);
            emit TransactionRejected(msg.sender, "finalization deadline expired");
        }
    }

    function withdrawPayout() public {
        withdrawPayoutTo(msg.sender);
    }

    function withdrawPayoutTo(address payable recipient) public {
        require(recipient != address(0), "Recipient cannot be zero");

        uint amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No payout available");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = recipient.call.value(amount)("");
        require(success, "Withdrawal failed");

        emit PayoutWithdrawn(recipient, amount);
    }

    function rescueSurplusEther(address payable recipient) public {
        require(realtor == msg.sender, "Only realtor can rescue surplus ether");
        require(recipient != address(0), "Recipient cannot be zero");
        require(
            contractState == ContractState.Finalized || contractState == ContractState.Rejected,
            "Surplus rescue only allowed after settlement"
        );

        uint trackedBalance = pendingWithdrawals[buyer]
            .add(pendingWithdrawals[seller])
            .add(pendingWithdrawals[realtor]);
        uint surplus = address(this).balance.sub(trackedBalance);
        require(surplus > 0, "No surplus ether available");

        (bool success, ) = recipient.call.value(surplus)("");
        require(success, "Surplus rescue failed");

        emit SurplusEtherRescued(msg.sender, recipient, surplus);
    }

    function _creditPayout(address payable recipient, uint amount) internal {
        // Pending payouts are accumulated across settlement paths, so use checked addition.
        pendingWithdrawals[recipient] = pendingWithdrawals[recipient].add(amount);
        emit PayoutCredited(recipient, amount);
    }
}
