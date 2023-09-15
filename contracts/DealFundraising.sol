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

///////////////////
// CUSTOM ERRORS //
///////////////////

error DealFundraising__WalletNotDaoMember(address wallet);
error DealFundraising__ImportingOldDealsNotSupported();
error DealFundraising__InputDataError();
error DealFundraising__UnknownDeal();
error DealFundraising__ZeroAmount();
error DealFundraising__NotEnoughTokens();
error DealFundraising__FundraisingNotActive();
error DealFundraising__AmountNotMatch(uint256 registerAmount, uint256 sentAmount);
error DealFundraising__MinAllocationNotMet(uint256 minAllocation, uint256 sentAmount);
error DealFundraising__MaxAllocationNotMet(uint256 maxAllocation, uint256 sentAmount);
error DealFundraising__TotalAllocationReached(uint256 totalAllocation);
error DealFundraising__NothingToWithdraw();
error DealFundraising__RefundsNotAllowed();

contract DealFundraising is IDealFundraising, AccessControl {
    //last update
    uint256 private lastChangeAt;
    bool private allowedImportingOldDeals = true;

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
        address withdrawDestination,
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

    function purchase(string memory dealUuid, uint256 amount) public override {
        if (!communityMemberNfts.hasCommunityNft(msg.sender)) {
            revert DealFundraising__WalletNotDaoMember(msg.sender);
        }
        // require(
        //     communityMemberNfts.hasCommunityNft(msg.sender),
        //     "Wallet is not DAO member"
        // );
        DealData memory deal = internalRegisterPurchase(
            msg.sender,
            dealUuid,
            amount
        );
        IERC20 token = deal.collectedToken;
        // @audit-issue unchecked return value, use safeTransferFrom instead
        // if a token is USDT and transfer fails, the call will not revert and msg.sender will be able to get portion of tokens in the deals due to 'dealsWalletsDeposits[dealUuid][recipient] += amount'
        // for more details, see here: https://github.com/sherlock-audit/2022-11-dodo-judging/issues/47
        token.transferFrom(msg.sender, address(this), amount);
        emit WalletPurchased(dealUuid, msg.sender, amount);
    }

    function importOldDealPurchase(
        string memory dealUuid,
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyRole(EDITOR_ROLE) {
        if (!allowedImportingOldDeals) {
            revert DealFundraising__ImportingOldDealsNotSupported();
        }
        // require(
        //     allowedImportingOldDeals = true,
        //     "Importing no longer supported"
        // );
        if (recipients.length != amounts.length) {
            revert DealFundraising__InputDataError()
        }
        // require(recipients.length == amounts.length, "Input data error");

        // @audit-info 
        // no need to initialize "n", default value is 0
        // each recipients.length costs extra gas, thus it's cheaper to cache it
        // removing n++ by unchecked block as there is no risk of overflow, thus it saves gas and ++n is cheaper
        uint256 recipientsLength = recipients.length;
        for (uint n; n < recipientsLength;)
            internalRegisterPurchase(recipients[n], dealUuid, amounts[n]);
            unchecked {
                ++n
            }
    }

    function revokeImportingOldDealPurchases() public onlyRole(EDITOR_ROLE) {
        allowedImportingOldDeals = false;
    }

    function internalRegisterPurchase(
        address recipient,
        string memory dealUuid,
        uint256 amount
    ) private returns (DealData memory) {
        if (!dealManager.existDealByUuid(dealUuid)) {
            revert DealFundraising__UnknownDeal();
        }
        // require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        if (amount == 0) {
            revert DealFundraising__ZeroAmount();
        }
        // require(amount > 0, "Amount has to be possitive");

        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        if (!deal.fundraisingActiveForRegistered && !deal.fundraisingActiveForEveryone) {
            revert DealFundraising__FundraisingNotActive();
        }
        // require(
        //     deal.fundraisingActiveForRegistered ||
        //         deal.fundraisingActiveForEveryone,
        //     "Fundraising is not active"
        // );

        // @audit-info double check that msg.sender has enough tokens
        if (!IERC20(deal.collectedToken).balanceOf(msg.sender) >= amount) {
            revert DealFundraising__NotEnoughTokens();
        }

        //if we're in the first round where only registered can ape exact amount
        if (!deal.fundraisingActiveForEveryone) {
            uint256 registeredInterest = dealInterestDiscovery
                .getRegisteredAmount(dealUuid, recipient);
            if (amount != registeredInterest) {
                revert DealFundraising__AmountNotMatch(reqisteredInterest, amount);
            }
            // require(
            //     amount == registeredInterest,
            //     "Only pre-registered exact amount allowed"
            // );
        }

        uint256 previousAmount = dealsWalletsDeposits[dealUuid][recipient];
        uint256 totalCollected = dealsDeposits[dealUuid];

        console.log(previousAmount, amount, deal.minAllocation); // @todo to be deleted before deployment

        uint256 amountToBeChecked = previousAmount + amount; // @note cache to save gas 
        if (amountToBeChecked < deal.minAllocation) {
            revert DealFundraising__MinAllocationNotMet(deal.minAllocation, amountToBeChecked);
        }
        // require(
        //     deal.minAllocation <= previousAmount + amount,
        //     "Minimum allocation not met"
        // );
        if (deal.maxAllocation < amountToBeChecked) {
            revert DealFundraising__MaxAllocationNotMet(deal.maxAllocation, amountToBeChecked);
        }
        // require(
        //     deal.maxAllocation >= previousAmount + amount,
        //     "Maximum allocation not met"
        // );
        if (totalCollected + amount > deal.totalAllocation) {
            revert DealFundraising__TotalAllocationReached(deal.totalAllocation);
        }
        // require(
        //     totalCollected + amount <= deal.totalAllocation,
        //     "Total allocation reached"
        // );

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
        // @audit unchecked return value, use safeTransferFrom instead
        // if a token is USDT and transfer fails, the call will not revert
        // for more details, see here: https://github.com/sherlock-audit/2022-11-dodo-judging/issues/47
        token.transfer(msg.sender, depositedAmount);

        emit WalletRefunded(dealUuid, msg.sender, depositedAmount);
    }

    function withdrawFundraisedTokens(
        string memory dealUuid,
        address withdrawDestination
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!dealManager.existDealByUuid(dealUuid)) {
            revert DealFundraising__UnknownDeal();
        }
        // require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        DealData memory deal = dealManager.getDealByUuid(dealUuid);

        if (!deal.refundAllowed) {
            revert DealFundraising__RefundsNotAllowed();
        }
        // require(deal.refundAllowed, "Refunds not active");
        uint256 withdrawed = dealsWithdrawals[dealUuid];
        uint256 collected = dealsDeposits[dealUuid];
        if (withdrawed >= collected) {
            revert DealFundraising__NothingToWithdraw();
        }
        // require(withdrawed < collected, "Nothing to withdraw");

        uint256 toWithdraw = collected - withdrawed;
        dealsWithdrawals[dealUuid] += toWithdraw;

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;

        IERC20 token = deal.collectedToken;
        // @audit unchecked return value, use safeTransferFrom instead + check return value!
        // if a token is USDT and transfer fails, the call will not revert, thus if a withdraw fails, the call will not revert, recepient does
        //   not get any tokens but contract's accounting gets updated anyway 
        // for more details, see here: https://github.com/sherlock-audit/2022-11-dodo-judging/issues/47
        token.transfer(withdrawDestination, toWithdraw);

        // @note missing event
        emit FundraiseTokensWithdrawn(
            dealUuid,
            withdrawDestination,
            toWithdraw
        );
    }

    /////////////
    // GETTERS //
    /////////////

    function dealsWalletsChangesCount(
        string memory dealUuid
    ) public view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }

    function getLastChange() external view returns (uint256) {
        return lastChangeAt;
    }

    function getAllowedImportingOldDeals() external view returns (bool) {
        return allowedImportingOldDeals;
    }
}
