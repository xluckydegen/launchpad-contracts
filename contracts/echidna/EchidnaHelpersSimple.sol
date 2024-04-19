// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {EchidnaSetup} from "./EchidnaSetup.sol";
import {DistributionData} from "contracts/v2/DistributionV2.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MockERC20} from "contracts/echidna/MockERC20.sol";
import {CompleteMerkle} from "murky/CompleteMerkle.sol";

error EchidnaHelpers__NoUserExists();

/// EchidnaHelpersSimple serves to substitute the process of Distribution data generation which is off-chain process
///  
contract EchidnaHelpersSimple is EchidnaSetup {
    struct User {
        address userAddress;
        uint256 maxAmount;
        bool created;
    }

    CompleteMerkle public merkle;

    address public defaultAdmin;
    address public distributor;

    // distribution params new
    uint8 public _usersCounter;
    uint8 public _tokensCounter;
    bool public _distributionEnabled;

    uint256 public _tokensTotal;
    uint256 public _tokensDistributable;
    bytes32 public _merkleRoot;

    mapping(uint8 _userId => User user) public _users;
    mapping(uint8 _userId => bytes32[] _proof) public _usersProofs;
    mapping(uint8 _tokenId => MockERC20 token) public _tokens;

    DistributionData public currentDistribution;

    event UserCreated(uint8 userId, address userAddress, uint256 maxAmount);

    constructor() {
        merkle = new CompleteMerkle();
        defaultAdmin = msg.sender;
        distributor = msg.sender;

        createNewToken();
    }

    function createUser(uint256 maxAmount) public {
        _usersCounter += 1;
        uint8 _newUserId = _usersCounter;
        // generate address from the user id
        address newUserAddress = address(uint160(_newUserId));
        // create new user object
        User memory newUser = User({userAddress: newUserAddress, maxAmount: maxAmount, created: true});
        // add new user to the active distribution
        _users[_usersCounter] = newUser;
        // update totals
        _tokensTotal += maxAmount;

        emit UserCreated(_newUserId, newUserAddress, maxAmount);
    }

    function getUserAddress(uint8 _userId) public view returns (address) {
        return _users[_userId].userAddress;
    }

    function getUserMaxAmount(uint8 _userId) public view returns (uint256) {
        return _users[_userId].maxAmount;
    }

    function getUserProof(uint8 _userId) public view returns (bytes32[] memory) {
        return _usersProofs[_userId];
    }

    function updateUserMaxAmount(uint8 _userId, uint256 _maxAmount) public {
        if (_usersCounter == 0) revert EchidnaHelpers__NoUserExists();
        if (_userId > _usersCounter) {
            _userId = (_userId % _usersCounter) + 1;
        }
        // recalculate tokensTotal
        _tokensTotal += _maxAmount - _users[_userId].maxAmount;
        // update user maxAmount in the given distribution data
        _users[_userId].maxAmount = _maxAmount;
    }

    // TODO reconsider this -> do we need to create new token by Echidna?
    function createNewToken() public {
        _tokensCounter += 1;
        string memory tokenName = string.concat("Token_", Strings.toString(_tokensCounter));
        string memory tokenTicker = string.concat("TST_", Strings.toString(_tokensCounter));
        MockERC20 newToken = new MockERC20(tokenName, tokenTicker);
        _tokens[_tokensCounter] = newToken;
    }

    function getToken(uint8 _tokenId) public view returns (MockERC20) {
        return _tokens[_tokenId];
    }

    function mintTokens(uint8 _userId, uint256 amount) public {
        address to;

        if (_userId == 0) {
            to = distributor;
        } else {
            if (_tokensCounter == 0) revert EchidnaHelpers__NoUserExists();
            if (_userId > _usersCounter) {
                _userId = (_userId % _tokensCounter) + 1;
            }
            to = _users[_userId].userAddress;
        }
        // hevm.prank(defaultAdmin); // NOTE deployer of the token is EchidnaHelpersSimple

        _tokens[_tokensCounter].mint(to, amount);
    }

    function setTokensDistributable(uint256 amount) public {
        _tokensDistributable = amount;
    }

    function enableDistribution(bool _enabled) public {
        _distributionEnabled = _enabled;
    }

    function storeDistributionData() public {
        DistributionData memory newDistribution;

        _generateMerkleRootAndUsersProofs();
        MockERC20 token = MockERC20(address(_tokens[_tokensCounter]));

        newDistribution.uuid = "TEST_UUID";
        newDistribution.token = token; // take the last one created
        newDistribution.merkleRoot = _merkleRoot;
        newDistribution.enabled = _distributionEnabled;
        newDistribution.tokensTotal = _tokensTotal;
        newDistribution.tokensDistributable = _tokensDistributable;

        currentDistribution = newDistribution;
    }

    function getCurrentDistribution() public view returns (DistributionData memory) {
        return currentDistribution;
    }

    function _generateMerkleRootAndUsersProofs() internal {
        bytes32[] memory leaves = new bytes32[](_usersCounter);
        for (uint8 i = 0; i < _usersCounter; i++) {
            address userAddress = _users[i].userAddress;
            uint256 userMaxAmount = _users[i].maxAmount;
            leaves[i] = keccak256(bytes.concat(keccak256(abi.encode(userAddress, userMaxAmount))));
        }
        _merkleRoot = merkle.getRoot(leaves);

        _updateUsersProofs(leaves);
    }

    function _updateUsersProofs(bytes32[] memory leaves) internal {
        for (uint8 i = 1; i <= _usersCounter; i++) {
            _usersProofs[i] = merkle.getProof(leaves, i);
        }
    }
}
