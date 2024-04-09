// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./CommunityMemberNft.sol";
import "./DealManager.sol";

error DealInterestDiscovery_UnknownDeal();
error DealInterestDiscovery_NotDaoMember();
error DealInterestDiscovery_MinimumNotMet();
error DealInterestDiscovery_MaximumNotMet();
error DealInterestDiscovery_InterestDiscoveryNotActive();
error DealInterestDiscovery_TotalAllocationReached();
error DealInterestDiscovery_ImportingNotAllowed();
error DealInterestDiscovery_InputDataError();

interface IDealInterestDiscovery {
    //register interest in specific deal (can be called multiple times)
    function registerInterest(string memory dealUuid, uint256 amount) external;

    //preregistered amount check
    function getRegisteredAmount(
        string memory dealUuid,
        address wallet
    ) external view returns (uint256);
}

contract DealInterestDiscovery is IDealInterestDiscovery, AccessControl {
    //last update
    uint256 public lastChangeAt;
    bool public allowedImportingOldDeals = true;

    IDealManager dealManager;
    ICommunityMemberNft communityMemberNfts;

    //DealInterestDiscovery data
    mapping(string => mapping(address => uint256)) public dealsWalletsInterest;
    mapping(string => address[]) public dealsWalletsChanges; //can be multiple times!
    mapping(string => uint256) public dealsInterest;
    mapping(string => uint256) public dealsLastChangeAt;

    //events
    event WalletRegistered(string dealUuid, address wallet, uint256 amount);

    //role
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");

    constructor(
        IDealManager _dealManager,
        ICommunityMemberNft _communityMemberNfts
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EDITOR_ROLE, msg.sender);
        dealManager = _dealManager;
        communityMemberNfts = _communityMemberNfts;
    }

    function registerInterest(string memory dealUuid, uint256 amount) external {
        internalRegisterInterest(msg.sender, dealUuid, amount);
    }

    function importOldDealInterests(
        string memory dealUuid,
        address[] memory recipients,
        uint256[] memory amounts
    ) external onlyRole(EDITOR_ROLE) {
        if (!allowedImportingOldDeals)
            revert DealInterestDiscovery_ImportingNotAllowed();
        if (recipients.length != amounts.length)
            revert DealInterestDiscovery_InputDataError();

        for (uint n = 0; n < recipients.length; n++)
            internalRegisterInterest(recipients[n], dealUuid, amounts[n]);
    }

    function revokeImportingOldDealInterests() external onlyRole(EDITOR_ROLE) {
        allowedImportingOldDeals = false;
    }

    function internalRegisterInterest(
        address recipient,
        string memory dealUuid,
        uint256 amount
    ) internal {
        if (!dealManager.existDealByUuid(dealUuid))
            revert DealInterestDiscovery_UnknownDeal();

        if (!communityMemberNfts.hasCommunityNft(recipient))
            revert DealInterestDiscovery_NotDaoMember();

        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        if (deal.minAllocation > amount && amount != 0)
            revert DealInterestDiscovery_MinimumNotMet();

        if (deal.maxAllocation < amount)
            revert DealInterestDiscovery_MaximumNotMet();

        if (!deal.interestDiscoveryActive)
            revert DealInterestDiscovery_InterestDiscoveryNotActive();

        uint256 previousAmount = dealsWalletsInterest[dealUuid][recipient];
        uint256 totalCollected = dealsInterest[dealUuid];
        dealsWalletsInterest[dealUuid][recipient] = amount;
        dealsWalletsChanges[dealUuid].push(recipient);

        if (amount > previousAmount) {
            uint256 diffAmount = amount - previousAmount;
            if (totalCollected + diffAmount > deal.totalAllocation)
                revert DealInterestDiscovery_TotalAllocationReached();

            dealsInterest[dealUuid] = totalCollected + diffAmount;
        } else {
            uint256 diffAmount = previousAmount - amount;
            dealsInterest[dealUuid] = totalCollected - diffAmount;
        }

        lastChangeAt = block.timestamp;
        dealsLastChangeAt[dealUuid] = block.timestamp;
        emit WalletRegistered(dealUuid, recipient, amount);
    }

    //preregistered amount check
    function getRegisteredAmount(
        string memory dealUuid,
        address wallet
    ) external view returns (uint256) {
        return dealsWalletsInterest[dealUuid][wallet];
    }

    function dealsWalletsChangesCount(
        string memory dealUuid
    ) external view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }
}
