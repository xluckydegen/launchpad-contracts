// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CommunityMemberNft.sol";
import "./DealManager.sol";
import "./DealInterestDiscovery.sol";
import "hardhat/console.sol";

using SafeERC20 for IERC20;

error DealFundraising_NotDaoMember();
error DealFundraising_ImportingNotAllowed();
error DealFundraising_InputDataError();
error DealFundraising_UnknownDeal();
error DealFundraising_InvalidAmount();
error DealFundraising_FundraisingNotAllowed();
error DealFundraising_OnlyPreregisteredAmountAllowed();
error DealFundraising_MinimumNotMet();
error DealFundraising_MaximumNotMet();
error DealFundraising_TotalAllocationReached();
error DealFundraising_RefundNotAllowed();
error DealFundraising_NothingToRefund();
error DealFundraising_NothingToWithdraw();
error DealFundraising_NotEnoughTokens();
error DealFundraising_ZeroAddress();
error DealFundraising_AmountsDoNotMatch();

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
    event FundraiseTokensWithdrawn(
        string dealUuid,
        address wallet,
        uint256 toWithdraw
    );

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

    function purchase(
        string memory dealUuid,
        uint256 amount
    ) external override {
        if (!communityMemberNfts.hasCommunityNft(msg.sender))
            revert DealFundraising_NotDaoMember();

        DealData memory deal = internalRegisterPurchase(
            msg.sender,
            dealUuid,
            amount
        );
        //check that msg.sender has enough tokens
        IERC20 token = deal.collectedToken;
        if (token.balanceOf(msg.sender) < amount)
            revert DealFundraising_NotEnoughTokens();
        // check balance before (protection against fee-on-transfer/rebasing tokens)
        uint256 balanceBefore = token.balanceOf(address(this));
        //transfer tokens
        token.safeTransferFrom(msg.sender, address(this), amount);
        // check balance after (protection against fee-on-transfer/rebasing tokens)
        uint256 balanceAfter = token.balanceOf(address(this));
        // check that amounts match
        if (balanceAfter - balanceBefore != amount) {
            // @note if fee-on-transfer/rebasing happened, this will always revert thus the given deal
            // will be totally unusable. Is this really what we want? Otherwise we would need to call
            // internalRegisterPurchase() here again(or implement something like updateRegisterPurchase() method).
            // The formal will make the transaction much more expensive; both will need to have reentrancy protection
            // implemented!!!
            revert DealFundraising_AmountsDoNotMatch();
        }
        emit WalletPurchased(dealUuid, msg.sender, amount);
    }

    function importOldDealPurchase(
        string memory dealUuid,
        address[] memory recipients,
        uint256[] memory amounts
    ) external onlyRole(EDITOR_ROLE) {
        if (!allowedImportingOldDeals)
            revert DealFundraising_ImportingNotAllowed();
        if (recipients.length != amounts.length)
            revert DealFundraising_InputDataError();

        for (uint n = 0; n < recipients.length; n++)
            internalRegisterPurchase(recipients[n], dealUuid, amounts[n]);
    }

    function revokeImportingOldDealPurchases() external onlyRole(EDITOR_ROLE) {
        allowedImportingOldDeals = false;
    }

    function internalRegisterPurchase(
        address recipient,
        string memory dealUuid,
        uint256 amount
    ) private returns (DealData memory) {
        if (!dealManager.existDealByUuid(dealUuid))
            revert DealFundraising_UnknownDeal();
        if (amount <= 0) revert DealFundraising_InvalidAmount();

        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        if (
            !deal.fundraisingActiveForRegistered &&
            !deal.fundraisingActiveForEveryone
        ) revert DealFundraising_FundraisingNotAllowed();

        //if we're in the first round where only registered can ape exact amount
        if (!deal.fundraisingActiveForEveryone) {
            uint256 registeredInterest = dealInterestDiscovery
                .getRegisteredAmount(dealUuid, recipient);
            if (amount != registeredInterest)
                revert DealFundraising_OnlyPreregisteredAmountAllowed();
        }

        uint256 previousAmount = dealsWalletsDeposits[dealUuid][recipient];
        uint256 totalCollected = dealsDeposits[dealUuid];

        if (deal.minAllocation > previousAmount + amount)
            revert DealFundraising_MinimumNotMet();
        if (deal.maxAllocation < previousAmount + amount)
            revert DealFundraising_MaximumNotMet();
        if (totalCollected + amount > deal.totalAllocation)
            revert DealFundraising_TotalAllocationReached();

        dealsWalletsDeposits[dealUuid][recipient] += amount;
        dealsDeposits[dealUuid] += amount;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;
        dealsWalletsChanges[dealUuid].push(recipient);

        return deal;
    }

    function refund(string memory dealUuid) external {
        if (!dealManager.existDealByUuid(dealUuid))
            revert DealFundraising_UnknownDeal();
        DealData memory deal = dealManager.getDealByUuid(dealUuid);

        if (!deal.refundAllowed) revert DealFundraising_RefundNotAllowed();

        uint256 depositedAmount = dealsWalletsDeposits[dealUuid][msg.sender];
        if (depositedAmount <= 0) revert DealFundraising_NothingToRefund();

        dealsWalletsDeposits[dealUuid][msg.sender] = 0;
        dealsDeposits[dealUuid] -= depositedAmount;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;
        dealsWalletsChanges[dealUuid].push(msg.sender);

        IERC20 token = deal.collectedToken;
        token.safeTransfer(msg.sender, depositedAmount);

        emit WalletRefunded(dealUuid, msg.sender, depositedAmount);
    }

    function withdrawFundraisedTokens(
        string memory dealUuid,
        address withdrawDestination
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (withdrawDestination == address(0))
            revert DealFundraising_ZeroAddress();
        if (!dealManager.existDealByUuid(dealUuid))
            revert DealFundraising_UnknownDeal();
        DealData memory deal = dealManager.getDealByUuid(dealUuid);

        uint256 withdrawed = dealsWithdrawals[dealUuid];
        uint256 collected = dealsDeposits[dealUuid];
        if (withdrawed >= collected) revert DealFundraising_NothingToWithdraw();

        uint256 toWithdraw = collected - withdrawed;
        dealsWithdrawals[dealUuid] += toWithdraw;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;

        IERC20 token = deal.collectedToken;
        token.safeTransfer(withdrawDestination, toWithdraw);

        emit FundraiseTokensWithdrawn(
            dealUuid,
            withdrawDestination,
            toWithdraw
        );
    }

    function dealsWalletsChangesCount(
        string memory dealUuid
    ) external view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }
}
