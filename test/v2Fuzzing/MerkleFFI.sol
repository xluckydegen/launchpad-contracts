// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { EchidnaSetup } from "./EchidnaSetup.sol";
import { DistributionData } from "contracts/v2/DistributionV2.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

error MerkleFFI__DistributionAlreadyExists(uint256 uuid);
error MerkleFFI__TokenAlreadyExists(uint256 uuid);
error MerkleFFI__AmountTooBig();

/**
 * NOT FINISHED, DECIDED TO GO WITH MURKY
 */

contract MerkleFFI is EchidnaSetup {
    struct User {
        address userAddress;
        uint256 maxAmount;
        bytes32 proof;
    }

    // distribution params
    uint256 private _currentUuid;
    mapping(uint256 => ERC20) private _tokens; // UUID => token
    mapping(uint256 => DistributionData) private _distributions; // UUID => distribution data
    mapping(uint256 => uint256) private _tokensTotals; // UUID => tokensTotal in distribution
    mapping(uint256 => uint256) private _tokensDistributables; // UUID => tokensDistributables in distribution
    mapping(uint256 => bytes32) private _merkleRoots; // UUID => merkleRoot
    mapping(uint256 => uint32) private _userIds; // UUID => current user id
    mapping(uint256 => mapping(uint256 => User)) private _users; // UUID => user_id => User
    mapping(uint256 => bool) private _enableds; // UUID => enabled

    function createNewUser(uint256 maxAmount) public {
        // create new user
        uint32 _currentUserId = _userIds[_currentUuid];
        address newUserAddress = address(_currentUserId);
        User newUser = User({ userAddress: newUserAddress, maxAmount: maxAmount });
        _users[_currentUuid][_currentUserId] = newUser;
        // increase user ids counter
        _userIds[_currentUuid] += 1;
        _tokensTotals[_currentUuid] += maxAmount;
    }

    /// 
    function _createMerkleRoot() internal {
        uint32 nUsers = _userIds[_currentUuid];
        string[] memory inputs = new string[](3 + nUsers * 2);
        inputs[0] = "npm";
        inputs[1] = "../../scripts/merkle-handler.ts"; // TODO add path to the script
        inputs[2] = string(toHex(abi.encodePacked(nUsers)));
        for (uint256 i; i < nUsers * 2; i++) {
            inputs[3 + i*2] = abi.encodePacked(_users[_currentUuid][i].userAddress);
            inputs[4 + i*2] = string(toHex(abi.encodePacked(_users[_currentUuid][i].maxAmount)));
        }
        bytes memory data = hevm.ffi(inputs);
    }

    function _getMerkleRootAndProofsFromData(bytes memory data, uint32 nUsers) internal {
        uint256 offset = 0;
        bytes32 root = abi.decode(data[offset:], (bytes32));
        offset += 32;
        for (uint256 i = 0; i < nUsers; i++) {

        }
    }

    // TODO update users maxAmounts (+ _tokensTotals)

    function createNewToken() public {
        if (_tokens[_currentUuid] != address(0)) {
            revert EchidnaHelpers__TokenAlreadyExists(_currentUuid);
        }
        string tokenName = string.concat("Token", _currentUuid);
        string tokenSymbol = string.concat("TST", _currentUuid);
        ERC20 newToken = new ERC20(tokenName, tokenSymbol);
        _tokens[_currentUuid] = newToken;
    }

    function setTokensDistributable(uint256 amount) public {
        if (amount > _tokensTotals[_currentUuid]) {
            revert EchidnaHelpers__AmountTooBig();
        }
        // TODO consider to add check of already deposited tokens
        _tokensDistributables[_currentUuid] = amount;
    }

    function enableDistribution(bool _enabled) public {
        _enableds[_currentUuid] = _enabled;
    }

    function createNewDistributionData() public {
        DistributionData memory newDistribution = distributions[_currentUuid];
        if (bytes(newDistribution.uuid).length != 0) {
            revert EchidnaHelpers__DistributionAlreadyExists(_currentUuid);
        }
        // NOTE have minting tokens here on just before depositTokensToDistribution?
        ERC20 newToken = _tokens[_currentUuid];
        newToken.mint(address(this), _tokensTotals[_currentUuid]);
        // TODO consider what we want to check here before assigning DistributionData

        // TODO Create Merkle Proof here

        newDistribution.uuid = string(_currentUuid);
        newDistribution.token = _tokens[_currentUuid];
        newDistribution.merkleRoot = _merkleRoots[_currentUuid];
        newDistribution.enabled = _enableds[_currentUuid];
        newDistribution.tokensTotal = _tokensTotals[_currentUuid];
        newDistribution.tokensDistributable = _tokensDistributables[_currentUuid];

        distributions[_currentUuid] = newDistribution;
    }

    // HELPERS //
    // @title convert to hex
    // copy-pasted from https://github.com/patrickd-/solidity-fuzzing-boilerplate/blob/main/src/test/helpers.sol#L35C1-L41C6
    function __toHex(bytes memory data) pure private returns (bytes memory) {
        res = new bytes(data.length * 2);
        bytes memory alphabet = "0123456789abcdef";
        for (uint i = 0; i < data.length; i++) {
            res[i*2 + 0] = alphabet[uint256(uint8(data[i])) >> 4];
            res[i*2 + 1] = alphabet[uint256(uint8(data[i])) & 15];
        }
        return res
}
