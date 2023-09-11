// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./CommunityMemberNft.sol";
import "./DealManager.sol";
import "./EmergencyWithdraw.sol";

interface IDealInterestDiscovery {
    //register interest in specific deal (can be called multiple times)
    function registerInterest(string memory dealUuid, uint256 amount) external;

    //preregistered amount check
    function getRegisteredAmount(
        string memory dealUuid,
        address wallet
    ) external view returns (uint256);
}

contract DealInterestDiscovery is IDealInterestDiscovery, AccessControl, EmergencyWithdraw {
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

    function registerInterest(
        string memory dealUuid,
        uint256 amount
    ) public override {
        require(dealManager.existDealByUuid(dealUuid), "Unknown deal");
        require(
            communityMemberNfts.hasCommunityNft(msg.sender),
            "Wallet is not DAO member"
        );
        DealData memory deal = dealManager.getDealByUuid(dealUuid);
        require(deal.minAllocation <= amount, "Minimum allocation not met");
        require(deal.maxAllocation >= amount, "Maximum allocation not met");
        require(deal.interestDiscoveryActive, "Interest discovery not active");

        uint256 previousAmount = dealsWalletsInterest[dealUuid][msg.sender];
        uint256 totalCollected = dealsInterest[dealUuid];
        dealsWalletsInterest[dealUuid][msg.sender] = amount;
        dealsWalletsChanges[dealUuid].push(msg.sender);

        if (amount > previousAmount) {
            uint256 diffAmount = amount - previousAmount;
            require(
                totalCollected + diffAmount <= deal.totalAllocation,
                "Total allocation reached"
            );

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

    function dealsWalletsChangesCount(
        string memory dealUuid
    ) public view returns (uint256) {
        return dealsWalletsChanges[dealUuid].length;
    }
}
