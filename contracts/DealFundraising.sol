// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./CommunityMemberNft.sol";
import "./DealManager.sol";
import "./DealInterestDiscovery.sol";
import "hardhat/console.sol";

interface IDealFundraising {
    //register interest in specific deal (can be called multiple times)
    function purchase(string memory dealUuid, uint256 amount) external;

    //refund to caller from specific deal (if refund is allowed)
    function refund(string memory dealUuid) external;

    //withdraw colleted tokens
    function withdrawFundraisedTokens(
        string memory dealUuid,
        address withdrawDestination
    ) external;
}

contract DealFundraising is IDealFundraising, AccessControl {
    //last update
    uint256 public lastChangeAt;
    bool public allowedImportingOldDeals = true;

    IDealManager dealManager;
    ICommunityMemberNft communityMemberNfts;
    IDealInterestDiscovery dealInterestDiscovery;

    //DealFundraising data
    mapping(string => mapping(address => uint256)) public dealsWalletsDeposits;
    mapping(string => address[]) public dealsWalletsChanges; //can be multiple times!
    mapping(string => uint256) public dealsDeposits;
    mapping(string => uint256) public dealsWithdrawals;
    mapping(string => uint256) public dealsLastChangeAt;

    //events
    event WalletPurchased(string dealUuid, address wallet, uint256 amount);
    event WalletRefunded(string dealUuid, address wallet, uint256 amount);

    //role
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");

    constructor(
        IDealManager _dealManager,
        ICommunityMemberNft _communityMemberNfts,
        IDealInterestDiscovery _dealInterestDiscovery
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EDITOR_ROLE, msg.sender);
        dealManager = _dealManager;
        communityMemberNfts = _communityMemberNfts;
        dealInterestDiscovery = _dealInterestDiscovery;
    }

    function purchase(string memory dealUuid, uint256 amount) public override {
        require(
            communityMemberNfts.hasCommunityNft(msg.sender),
            "Wallet is not DAO member"
        );
        DealData memory deal = internalRegisterPurchase(
            msg.sender,
            dealUuid,
            amount
        );
        IERC20 token = deal.collectedToken;
        token.transferFrom(msg.sender, address(this), amount);
        emit WalletPurchased(dealUuid, msg.sender, amount);
    }

    function importOldDealPurchase(
        string memory dealUuid,
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyRole(EDITOR_ROLE) {
        require(allowedImportingOldDeals=true, "Importing no longer supported");
        require(recipients.length == amounts.length, "Input data error");
        for (uint n = 0; n < recipients.length; n++)
            internalRegisterPurchase(recipients[n], dealUuid, amounts[n]);
    }

    function revokeImportingOldDealPurchases() public onlyRole(EDITOR_ROLE)
    {
        allowedImportingOldDeals = false;
    }

    function internalRegisterPurchase(
        address recipient,
        string memory dealUuid,
        uint256 amount
    ) private returns (DealData memory) {
        require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        require(amount > 0, "Amount has to be possitive");

        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        require(
            deal.fundraisingActiveForRegistered ||
                deal.fundraisingActiveForEveryone,
            "Fundraising is not active"
        );

        //if we're in the first round where only registered can ape exact amount
        if (!deal.fundraisingActiveForEveryone) {
            uint256 registeredInterest = dealInterestDiscovery
                .getRegisteredAmount(dealUuid, recipient);
            require(
                amount == registeredInterest,
                "Only pre-registered exact amount allowed"
            );
        }

        uint256 previousAmount = dealsWalletsDeposits[dealUuid][recipient];
        uint256 totalCollected = dealsDeposits[dealUuid];

        console.log(previousAmount,amount,deal.minAllocation);
        require(deal.minAllocation <= previousAmount+amount, "Minimum allocation not met");
        require(deal.maxAllocation >= previousAmount+amount, "Maximum allocation not met");
        require(
            totalCollected + amount <= deal.totalAllocation,
            "Total allocation reached"
        );

        dealsWalletsDeposits[dealUuid][recipient] += amount;
        dealsDeposits[dealUuid] += amount;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;
        dealsWalletsChanges[dealUuid].push(recipient);

        return deal;
    }

    function refund(string memory dealUuid) public {
        require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        DealData memory deal = dealManager.getDealByUuid(dealUuid);

        uint256 depositedAmount = dealsWalletsDeposits[dealUuid][msg.sender];
        require(depositedAmount > 0, "Nothing to refund");

        dealsWalletsDeposits[dealUuid][msg.sender] = 0;
        dealsDeposits[dealUuid] -= depositedAmount;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;
        dealsWalletsChanges[dealUuid].push(msg.sender);

        IERC20 token = deal.collectedToken;
        token.transfer(msg.sender, depositedAmount);

        emit WalletRefunded(dealUuid, msg.sender, depositedAmount);
    }

    function withdrawFundraisedTokens(
        string memory dealUuid,
        address withdrawDestination
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        DealData memory deal = dealManager.getDealByUuid(dealUuid);

        require(deal.refundAllowed, "Refunds not active");
        uint256 withdrawed = dealsWithdrawals[dealUuid];
        uint256 collected = dealsDeposits[dealUuid];
        require(withdrawed < collected, "Nothing to withdraw");

        uint256 toWithdraw = collected - withdrawed;
        dealsWithdrawals[dealUuid] += toWithdraw;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;

        IERC20 token = deal.collectedToken;
        token.transfer(withdrawDestination, toWithdraw);
    }

    function dealsWalletsChangesCount(
        string memory dealUuid
    ) public view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }
}
