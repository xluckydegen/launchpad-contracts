// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { EchidnaSetup } from "./EchidnaSetup.sol";
import { DistributionData } from "contracts/v2/DistributionV2.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { MockERC20 } from "contracts/echidna/MockERC20.sol";
import { CompleteMerkle } from "murky/CompleteMerkle.sol";

error EchidnaMerkleHelpers__NoUserExists();
error EchidnaMerkleHelpers__UserDoesNotExist();
error EchidnaMerkleHelpers__MaxUsersReached();
error EchidnaMerkleHelpers__NoTokenExists();

/// @title Echidna Merkle Helpers
/// @notice EchidnaMerkleHelpers serves to substitute the process of Distribution Data Generation which is an off-chain process
/// the idea here is to let Echidna create own distribution data on-chain
contract EchidnaMerkleHelpers is EchidnaSetup {
    struct User {
        address userAddress;
        uint256 maxAmount;
        bool created;
    }

    CompleteMerkle public merkle;

    address public defaultAdmin;
    address public distributor;

    // counters 
    uint8 public _usersCounter;
    uint8 public _tokensCounter;
    // distribution parameters when storeDistributionData is called
    bool public _distributionEnabled;
    uint256 public _tokensTotal;
    uint256 public _tokensDistributable;
    bytes32 public _merkleRoot;
    MockERC20 public _token;
    DistributionData public currentDistribution;
    // mappings
    mapping(uint8 _userId => User user) public _users;
    mapping(uint8 _userId => bytes32[] _proof) public _usersProofs;
    mapping(uint8 _tokenId => MockERC20 token) public _tokens;

    event UserCreated(uint8 userId, address userAddress, uint256 maxAmount);

    constructor(address _defaultAdmin, address _distributor) {
        merkle = new CompleteMerkle();

        defaultAdmin = _defaultAdmin;
        distributor = _distributor;

        createNewToken();
    }

    /**
     * @notice Creates a new user
     * @dev once USER_COUNT is reached, now users can't be created anymore
     */
    function createUser(uint256 maxAmount) public {
        if (_usersCounter == USER_COUNT) revert EchidnaMerkleHelpers__MaxUsersReached();
        uint8 _newUserId = _usersCounter;
        // generate address from the user id
        address newUserAddress = getUserAccount(_newUserId);
        // create new user object
        User memory newUser = User({ userAddress: newUserAddress, maxAmount: maxAmount, created: true });
        // add new user to the active distribution
        _users[_usersCounter] = newUser;
        // update totals
        _tokensTotal += maxAmount;
        // update users counter
        _usersCounter += 1;

        emit UserCreated(_newUserId, newUserAddress, maxAmount);
    }

    /**
     * @notice Update user's maxAmount
     * @dev if user doesn't exist, revert
     */
    function updateUserMaxAmount(uint8 _userId, uint256 _maxAmount) public {
        // get user id
        _userId = _getUserId(_userId);
        if (_users[_userId].created == false) revert EchidnaMerkleHelpers__UserDoesNotExist();
        // update tokensTotal
        _tokensTotal += _maxAmount - _users[_userId].maxAmount;
        // update user maxAmount in the given distribution data
        _users[_userId].maxAmount = _maxAmount;
    }

    /**
     * @notice Creates a new token
     * @dev Token in each distribution can be changed, thus letting Echidna to create one
     */
    function createNewToken() public {
        string memory tokenName = string.concat("Token_", Strings.toString(_tokensCounter));
        string memory tokenTicker = string.concat("TST_", Strings.toString(_tokensCounter));
        MockERC20 newToken = new MockERC20(tokenName, tokenTicker);
        _tokens[_tokensCounter] = newToken;
        _tokensCounter += 1;
    }

    /**
     * @notice Set token for the current distribution
     */
    function setToken(uint8 _tokenId) public {
        _token = getToken(_tokenId);
    }

    function mintTokensToUser(uint8 _userId, uint8 _tokenId, uint256 amount) public {
        if (_tokensCounter == 0) revert EchidnaMerkleHelpers__NoTokenExists();
        _userId = _userId % USER_COUNT;
        _tokenId = _tokenId % _tokensCounter;
        if (_users[_userId].created == false) revert EchidnaMerkleHelpers__UserDoesNotExist();
        address to = _users[_userId].userAddress;
        _tokens[_tokenId].mint(to, amount);
    }

    function mintTokenToAdmin(uint8 _tokenId, uint256 amount) public {
        if (_tokensCounter == 0) revert EchidnaMerkleHelpers__NoTokenExists();
        _tokenId = _tokenId % _tokensCounter;
        _tokens[_tokenId].mint(defaultAdmin, amount);
    }

    function mintTokenToDistributor(uint8 _tokenId, uint256 amount) public {
        if (_tokensCounter == 0) revert EchidnaMerkleHelpers__NoTokenExists();
        _tokenId = _tokenId % _tokensCounter;
        _tokens[_tokenId].mint(distributor, amount);
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

        newDistribution.uuid = "TEST_UUID";
        newDistribution.token = _token;
        newDistribution.merkleRoot = _merkleRoot;
        newDistribution.enabled = _distributionEnabled;
        newDistribution.tokensTotal = _tokensTotal;
        newDistribution.tokensDistributable = _tokensDistributable;

        currentDistribution = newDistribution;
    }

    //////////////////////
    // INTERNAL HELPERS //
    //////////////////////

    /**
     * @notice Generates merkle root and users proofs for current users
     */
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
        for (uint8 i; i < _usersCounter; i++) {
            _usersProofs[i] = merkle.getProof(leaves, i);
        }
    }

    /////////////
    // GETTERS //
    /////////////

    function _getUserId(uint8 _userId) internal view returns (uint8) {
        _userId = _userId % USER_COUNT;
        return _userId;
    }

    function getUserAddress(uint8 _userId) public view returns (address) {
        _userId = _getUserId(_userId);
        return _users[_userId].userAddress;
    }

    function getUserMaxAmount(uint8 _userId) public view returns (uint256) {
        _userId = _getUserId(_userId);
        return _users[_userId].maxAmount;
    }

    function getUserProof(uint8 _userId) public view returns (bytes32[] memory) {
        _userId = _getUserId(_userId);
        return _usersProofs[_userId];
    }

    function getToken(uint8 _tokenId) public view returns (MockERC20) {
        if (_tokensCounter == 0) revert EchidnaMerkleHelpers__NoTokenExists();
        _tokenId = _tokenId % _tokensCounter;
        return _tokens[_tokenId];
    }

    function getCurrentDistribution() public view returns (DistributionData memory) {
        return currentDistribution;
    }
}
