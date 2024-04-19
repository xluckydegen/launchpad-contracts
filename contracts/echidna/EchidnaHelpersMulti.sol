// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {EchidnaSetup} from "./EchidnaSetup.sol";
import {DistributionData} from "contracts/v2/DistributionV2.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MockERC20} from "contracts/echidna/MockERC20.sol";
import {CompleteMerkle} from "murky/CompleteMerkle.sol";

error EchidnaHelpers__DistributionDoesNotExist(uint8 uuid);
error EchidnaHelpers__DistributionAlreadyExists(uint8 uuid);
error EchidnaHelpers__NoDistributionExists();
error EchidnaHelpers__AmountTooBig();
error EchidnaHelpers__TokenAlreadyExists(uint8 distributionId);
error EchidnaHelpers__UserDoesNotExist(uint8 userId);
error EchidnaHelpers__NoUserExists(uint8 distributionId);

/// APPROACHES
/// (2) having multiple distributions data (with different merkles)

/////////////////////////////////////////////////////////////////////
// IMPORTANT NOTE - NOT FINISHED, IT IS NOT SUPPOSED TO BE WORKING //
/////////////////////////////////////////////////////////////////////

contract EchidnaHelpersMulti is EchidnaSetup {
    struct User {
        address userAddress;
        uint256 maxAmount;
        // bytes32[] proof;
        bool created;
    }

    CompleteMerkle public merkle;

    address defaultAdmin;
    address distributor;

    // distribution params
    uint8 private _uuidCounter;
    uint8 private _activeUuid;
    uint8 private _activeUserId;
    mapping(uint8 => MockERC20) private _tokens; // UUID => token
    mapping(uint8 => DistributionData) private _distributions; // UUID => distribution data
    mapping(uint8 => uint256) private _tokensTotals; // UUID => tokensTotal in distribution
    mapping(uint8 => uint256) private _tokensDistributables; // UUID => tokensDistributables in distribution
    mapping(uint8 => bytes32) private _merkleRoots; // UUID => merkleRoot
    mapping(uint8 => uint8) private _userIds; // UUID => current user id
    mapping(uint8 => mapping(uint8 => User)) private _users; // UUID => user_id => User
    mapping(uint8 => mapping(uint8 => bytes32[])) private _usersProofs; // UUID => user_id => proof
    mapping(uint8 => bool) private _enableds; // UUID => enabled

    constructor() {
        merkle = new CompleteMerkle();
        defaultAdmin = msg.sender;
        distributor = msg.sender;

        // TODO create first distribution data?
    }

    function setActiveUuid(uint8 _uuid) public {
        // if no distributions exists, revert
        if (_uuidCounter == 0) revert EchidnaHelpers__NoDistributionExists();
        // set active uuid
        _activeUuid = _uuid % _uuidCounter;
    }

    function setActiveUserId(uint8 _userId) public {
        // if no users exists for the given distribution, revert
        if (_uuidCounter == 0) revert EchidnaHelpers__NoDistributionExists();
        if (_userIds[_activeUuid] == 0) revert EchidnaHelpers__NoUserExists(_activeUuid);
        _activeUserId = _userId % _userIds[_activeUuid];
    }

    function createUser(uint256 maxAmount) public {
        // define new user id in the active distribution
        uint8 _currentUserId = _userIds[_activeUuid] + 1; // TODO consider to start from 1?
        // generate address from the user id
        address newUserAddress = address(uint160(_currentUserId));
        // create new user object
        User memory newUser = User({
            userAddress: newUserAddress,
            maxAmount: maxAmount,
            // proof: new bytes32, // init empty proof
            created: true
        });
        // add new user to the active distribution
        _users[_activeUuid][_activeUserId] = newUser;
        // increase user ids counter for the active distribution
        _userIds[_activeUuid] += 1;
        _tokensTotals[_activeUuid] += maxAmount;
    }

    function updateUserMaxAmount(uint256 maxAmount) public {
        // checks
        if (_uuidCounter == 0) revert EchidnaHelpers__NoDistributionExists();
        if (_userIds[_activeUuid] == 0) revert EchidnaHelpers__NoUserExists(_activeUuid);
        // recalculate tokensTotal
        _tokensTotals[_activeUserId] += maxAmount - _users[_activeUuid][_activeUserId].maxAmount;
        // update user maxAmount in the given distribution data
        _users[_activeUuid][_activeUserId].maxAmount = maxAmount;
        // TODO move the following part before calling setDistributionData to save calls
        // update merkle root and proofs
        _generateMerkleRootAndUsersProofs(_activeUuid);
    }

    function _generateMerkleRootAndUsersProofs(uint8 uuid) internal {
        uint8 nUsers = _userIds[uuid];
        // TODO add a require statement if `nUsers == 0` (to navigate Echidna or is this a valid state)?
        bytes32[] memory leaves = new bytes32[](nUsers);
        for (uint8 i = 0; i < nUsers; i++) {
            address userAddress = _users[uuid][i].userAddress;
            uint256 userMaxAmount = _users[uuid][i].maxAmount;
            leaves[i] = keccak256(bytes.concat(keccak256(abi.encode(userAddress, userMaxAmount))));
        }
        bytes32 root = merkle.getRoot(leaves);
        _merkleRoots[uuid] = root;

        _updateUsersProofs(uuid, leaves);
    }

    function _updateUsersProofs(uint8 uuid, bytes32[] memory leaves) internal {
        uint8 nUsers = _userIds[uuid];
        for (uint8 i = 0; i < nUsers; i++) {
            _usersProofs[uuid][i] = merkle.getProof(leaves, i);
        }
    }

    function createNewTokenForActiveDistribution() public {
        // if (_tokens[_activeUuid] != address(0)) {
        //     revert EchidnaHelpers__TokenAlreadyExists(_lastUuid);
        // }
        string memory tokenName = string.concat("Token", Strings.toString(_activeUuid));
        string memory tokenSymbol = string.concat("TST", Strings.toString(_activeUuid));

        MockERC20 newToken = new MockERC20(tokenName, tokenSymbol);

        _tokens[_activeUuid] = newToken;
    }

    function mintTokens(uint8 _userId, uint256 amount) public {
        address to;
        if (_userId == 0) {
            to = distributor;
        } else {
            if (_userIds[_activeUuid] == 0) revert EchidnaHelpers__NoUserExists(_activeUuid);
            uint8 userId = _userId % _userIds[_activeUuid];
            to = _users[_activeUuid][userId].userAddress;
        }
        hevm.prank(distributor);
        _tokens[_activeUuid].mint(to, amount);
    }

    function setTokensDistributable(uint256 amount) public {
        if (_uuidCounter == 0) revert EchidnaHelpers__NoDistributionExists();
        // TODO consider to add check of already deposited tokens
        _tokensDistributables[_activeUuid] = amount;
    }

    function enableDistribution(bool _enabled) public {
        if (_uuidCounter == 0) revert EchidnaHelpers__NoDistributionExists();
        _enableds[_activeUuid] = _enabled;
    }

    function createNewDistributionData() public {
        // TODO consider creating a new distribution which will always be valid?

        // set new distribution id
        uint8 uuid = _uuidCounter + 1;

        DistributionData memory newDistribution;

        _generateMerkleRootAndUsersProofs(uuid);
        // TODO create it even here?
        createNewTokenForActiveDistribution();

        newDistribution.uuid = Strings.toString(uuid);
        newDistribution.token = _tokens[uuid];
        newDistribution.merkleRoot = _merkleRoots[uuid];
        newDistribution.enabled = _enableds[uuid];
        newDistribution.tokensTotal = _tokensTotals[uuid];
        newDistribution.tokensDistributable = _tokensDistributables[uuid];

        _distributions[uuid] = newDistribution;

        // increment the current uuid counter as we are creating new distribution
        _uuidCounter += 1;
    }

    function updateExistingDistributionData(uint8 _uuid) public {
        uint8 uuid = _uuid % _uuidCounter;

        // TODO this wont work if we do not update _distributions once it is stored in the target contract
        if (_distributions[_activeUuid].createdAt == 0) revert EchidnaHelpers__DistributionDoesNotExist(uuid);

        _generateMerkleRootAndUsersProofs(uuid);

        _distributions[uuid].token = _tokens[uuid];
        _distributions[uuid].merkleRoot = _merkleRoots[uuid];
        _distributions[uuid].enabled = _enableds[uuid];
        _distributions[uuid].tokensTotal = _tokensTotals[uuid];
        _distributions[uuid].tokensDistributable = _tokensDistributables[uuid];
    }
}
