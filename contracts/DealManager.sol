// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

error DealManager_InvalidDealId();
error DealManager_InvalidDealData(string msg);

struct DealData {
    string uuid;
    uint createdAt;
    uint updatedAt;
    bool interestDiscoveryActive;
    bool fundraisingActiveForRegistered;
    bool fundraisingActiveForEveryone;
    bool refundAllowed;
    uint256 minAllocation;
    uint256 maxAllocation;
    uint256 totalAllocation;
    IERC20 collectedToken;
}

interface IDealManager {
    function storeDeal(DealData memory deal) external;

    function existDealByUuid(string memory uuid) external view returns (bool);

    function countDeals() external view returns (uint);

    function getDealByUuid(
        string memory uuid
    ) external view returns (DealData memory);

    function getDealById(uint256 id) external view returns (DealData memory);
}

contract DealManager is IDealManager, AccessControl {
    //last update
    uint public lastChangeAt;

    //DealInterestDiscovery data
    string[] public dealsIndexed;
    mapping(string => DealData) public deals;

    //events
    event DealStored(string uuid);

    //role
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EDITOR_ROLE, msg.sender);
    }

    function storeDeal(
        DealData memory deal
    ) public override onlyRole(EDITOR_ROLE) {
        if ( bytes(deal.uuid).length == 0)
           revert DealManager_InvalidDealData("IU");
        // @audit 0 values for min/max allocation allowed?
        if (
            deal.minAllocation != 0 &&
            deal.maxAllocation != 0 &&
            deal.minAllocation > deal.maxAllocation
        ) revert DealManager_InvalidDealData("MIN");
        if (deal.totalAllocation < deal.maxAllocation)
            revert DealManager_InvalidDealData("MAX");
        if (address(deal.collectedToken) == address(0))
            revert DealManager_InvalidDealData("TOK");

        deal.updatedAt = block.timestamp;
        if (deal.createdAt == 0) deal.createdAt = block.timestamp;

        DealData memory dealStored = deals[deal.uuid];
        if (dealStored.createdAt == 0) dealsIndexed.push(deal.uuid);
        deals[deal.uuid] = deal;

        lastChangeAt = block.timestamp;
        emit DealStored(deal.uuid);
    }

    function existDealByUuid(
        string memory uuid
    ) public view override returns (bool) {
        return deals[uuid].createdAt != 0;
    }

    function countDeals() public view override returns (uint) {
        return dealsIndexed.length;
    }

    function getDealById(
        uint256 id
    ) public view override returns (DealData memory) {
        if (id >= dealsIndexed.length) revert DealManager_InvalidDealId();
        string memory uuid = dealsIndexed[id];
        return deals[uuid];
    }

    function getDealByUuid(
        string memory uuid
    ) public view override returns (DealData memory) {
        return deals[uuid];
    }
}
