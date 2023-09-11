// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./EmergencyWithdraw.sol";

struct CommunityData {
    uint createdAt;
}

interface ICommunityManager {
    function registerCommunity(string memory uuid) external;

    function existCommunityByUuid(
        string memory uuid
    ) external view returns (bool);

    function getCommunityByUuid(
        string memory uuid
    ) external view returns (CommunityData memory);

    function getCommunityById(
        uint256 id
    ) external view returns (CommunityData memory);

    function countCommunities() external view returns (uint);
}

contract CommunityManager is ICommunityManager, AccessControl, EmergencyWithdraw {
    //last update
    uint public lastChangeAt;

    string[] public communitiesIndexed;
    mapping(string => CommunityData) public communities;

    //events
    event CommunityRegistered(uint communityId, string uuid);

    //role
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EDITOR_ROLE, msg.sender);
    }

    function registerCommunity(
        string memory uuid
    ) public override onlyRole(EDITOR_ROLE) {
        require(communities[uuid].createdAt == 0, "Community already exists");

        lastChangeAt = block.timestamp;
        communities[uuid] = CommunityData(block.timestamp);
        communitiesIndexed.push(uuid);
        emit CommunityRegistered(communitiesIndexed.length - 1, uuid);
    }

    function existCommunityByUuid(
        string memory uuid
    ) public view override returns (bool) {
        return communities[uuid].createdAt != 0;
    }

    function countCommunities() public view override returns (uint) {
        return communitiesIndexed.length;
    }

    function getCommunityById(
        uint256 id
    ) public view override returns (CommunityData memory) {
        require(id < communitiesIndexed.length, "Out of bounds");
        string memory uuid = communitiesIndexed[id];
        return communities[uuid];
    }

    function getCommunityByUuid(
        string memory uuid
    ) public view override returns (CommunityData memory) {
        return communities[uuid];
    }
}
