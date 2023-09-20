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

    IDealManager dealManager;
    ICommunityMemberNft communityMemberNfts;

    //DealInterestDiscovery data
    mapping(string => mapping(address => uint256)) public dealsWalletsInterest;
    mapping(string => address[]) public dealsWalletsChanges; //can be multiple times!
    mapping(string => uint256) public dealsInterest;
    mapping(string => uint256) public dealsLastChangeAt;

    //events
    event WalletRegistered(string dealUuid, address wallet, uint256 amount);

    constructor(
        IDealManager _dealManager,
        ICommunityMemberNft _communityMemberNfts
    ) {
        dealManager = _dealManager;
        communityMemberNfts = _communityMemberNfts;
    }

    // making external as function is not called in the contract itself
    function registerInterest(string memory dealUuid, uint256 amount) external {
        if (!dealManager.existDealByUuid(dealUuid))
            revert DealInterestDiscovery_UnknownDeal();

        if (!communityMemberNfts.hasCommunityNft(msg.sender))
            revert DealInterestDiscovery_NotDaoMember();

        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        if (deal.minAllocation > amount && amount != 0)
            revert DealInterestDiscovery_MinimumNotMet();

        if (deal.maxAllocation < amount)
            revert DealInterestDiscovery_MaximumNotMet();

        if (!deal.interestDiscoveryActive)
            revert DealInterestDiscovery_InterestDiscoveryNotActive();

        uint256 previousAmount = dealsWalletsInterest[dealUuid][msg.sender];
        uint256 totalCollected = dealsInterest[dealUuid];
        dealsWalletsInterest[dealUuid][msg.sender] = amount;
        dealsWalletsChanges[dealUuid].push(msg.sender);

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
        emit WalletRegistered(dealUuid, msg.sender, amount);
    }

    //preregistered amount check
    function getRegisteredAmount(
        string memory dealUuid,
        address wallet
    ) public view returns (uint256) {
        return dealsWalletsInterest[dealUuid][wallet];
    }

    // making external as function is not called in the contract itself
    function dealsWalletsChangesCount(
        string memory dealUuid
    ) external view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }
}
