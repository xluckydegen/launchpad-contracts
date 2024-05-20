// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData, IERC20 } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaHelpers } from "./EchidnaHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";
import { Debugger } from "./Debugger.sol";

error EchidnaTestDistribution_NoTokenSet();
error EchidnaTestDistribution_Paused();
error EchidnaTestDistribution_WalletRedirected();
error EchidnaTestDistribution_NotEnoughUsers();
error EchidnaTestDistribution_NotEnoughTokens();
error EchidnaTestDistribution_NothingToClaim();

/**
 * @title Fuzzing Campaign to test invariants
 * @author 0xharold
 */
contract EchidnaTestDistribution is EchidnaHelpers {
    constructor() {}

    /////////////////////////////////
    // Claims and Claiming Process //
    /////////////////////////////////

    // 1.1. Users cannot claim more tokens than `maxAmount`
    // -> invariant check via accounting
    function usersCannotClaimMoreTokensThanMaxAmount(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();

        address userAddress = getUserAddress(_userId);
        uint256 userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, userAddress);
        uint256 userAmountClaimed = distribution.getWalletClaims(_data.uuid, userAddress);

        Debugger.log("userAddress", userAddress);
        Debugger.log("userMaxAmount", userMaxAmount);
        Debugger.log("userAmountClaimed", userAmountClaimed);

        assert(userAmountClaimed <= userMaxAmount);
    }

    // 1.1. User cannot claim more tokens than their `maxAmount`
    // -> invariant check via function call
    function userCannotClaimIfAlreadyClaimedMaxAmount(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();

        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        if (_data.enabled == false) revert EchidnaTestDistribution_Paused();

        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProofByUserId(_userId, _data.merkleRoot);

        IERC20 _token = _data.token;
        uint256 contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 userAlreadyClaimed = distribution.getWalletClaims(_data.uuid, _userAddress);
        // contract must hold some tokens and user must have already claimed all tokens
        if (contractBalanceBefore > 0 && userAlreadyClaimed >= _userMaxAmount) {
            hevm.prank(_userAddress);
            try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
                assert(false);
            } catch {
                assert(true);
            }
        }
    }

    // 1.2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
    function userCannotClaimWhenPaused(uint8 _userId) public {
        distribution.emergencyDistributionsPause(true);
        DistributionData memory _data = getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProofByUserId(_userId, _data.merkleRoot);

        hevm.prank(_userAddress);
        try distribution.claim(distributionUuid, _userMaxAmount, _userProof) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    // 1.3. User cannot claim more tokens proportionally to `tokensDistributable`, i.e. total amount of claimed tokens
    // must be always lower then user's `maxAmount`
    function userCannotClaimMoreTokenProportionallyToTokensDistributable(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProofByUserId(_userId, _data.merkleRoot);

        IERC20 _token = _data.token;
        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));

        if (_contractBalanceBefore > 0) {
            if (_data.tokensDistributable > 0 && _data.tokensDistributable < _data.tokensTotal) {
                hevm.prank(_userAddress);
                distribution.claim(_data.uuid, _userMaxAmount, _userProof);
                uint256 userClaimedTotal = distribution.getWalletClaims(_data.uuid, _userAddress);

                Debugger.log("_data.tokensDistributable", _data.tokensDistributable);
                Debugger.log("_data.tokensTotal", _data.tokensTotal);
                Debugger.log("_userMaxAmount", _userMaxAmount);
                Debugger.log("userClaimedTotal", userClaimedTotal);

                assert(userClaimedTotal < _userMaxAmount);
            }
        }
    }

    // 1.7 a wallet which funds has been redirected from cannot claim anymore
    function redirectedWalletCannotClaimAnymore(uint8 _userId) public {
        address userAddress = getUserAddress(_userId);
        if (_isAddressRedirectedFrom(userAddress)) {
            DistributionData memory _data = getCurrentDistribution();

            uint256 maxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, userAddress);
            bytes32[] memory proof = getUserProofByUserAddress(userAddress, _data.merkleRoot);

            hevm.prank(userAddress);
            try distribution.claim(_data.uuid, maxAmount, proof) {
                Debugger.log("userAddress", userAddress);
                Debugger.log("maxAmount", maxAmount);
                assert(false);
            } catch {
                assert(true);
            }
        }
    }

    // 1.4. User's token balance must always increase after successful claim.
    // 1.5. Distribution's token balance must always decrease after successful claim.
    // 1.6. User can always claim if eligible
    // 2.4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.
    function userSuccessfulClaimInvariants(uint8 _userId) public {
        // be sure that emergency pause has not been activated
        distribution.emergencyDistributionsPause(false);
        DistributionData memory _data = getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        if (_isAddressRedirectedFrom(_userAddress) || _isAddressRedirectedTo(_userAddress)) {
            // if an address has been redirected from, address is not supposed to claim anymore, thus reverting here
            // if an address has been redirected to, the test would fail as well because all users created in fuzzing
            // campaign are the part of the distribution and this cannot happen in reality (it is handled by the admin, i.e. offchain part)
            revert EchidnaTestDistribution_WalletRedirected();
        }
        // check if the user's wallet is recipient of redirection, if so, we need to get valid
        // user amount and thus stemming proof thereof
        address addressWithValidProof = _getAddressOfOrigin(_userAddress);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(
            _data.merkleRoot,
            addressWithValidProof
        );
        bytes32[] memory _userProof = getUserProofByUserAddress(
            addressWithValidProof,
            _data.merkleRoot
        );
        // token
        IERC20 _token = _data.token;
        uint256 contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 userClaimableAmount = _getClaimableAmount(addressWithValidProof);
        uint256 userAlreadyClaimed = distribution.getWalletClaims(_data.uuid, _userAddress);
        if (userClaimableAmount == 0 || userAlreadyClaimed == userClaimableAmount) {
            // there is nothing to claim, thus it does not make sense to continue the test
            revert EchidnaTestDistribution_NothingToClaim();
        }
        if (userClaimableAmount > contractBalanceBefore) {
            // claim would fail, thus ending the test
            revert EchidnaTestDistribution_NotEnoughTokens();
        }
        // logs
        Debugger.log("userAddress", _userAddress);
        Debugger.log("addressWithValidProof", addressWithValidProof);
        Debugger.log("userClaimableAmount", userClaimableAmount);
        Debugger.log("userAlreadyClaimed", userAlreadyClaimed);
        Debugger.log("userMaxAmount", _userMaxAmount);
        Debugger.log("contractBalanceBefore", contractBalanceBefore);
        // does not make sense to test anymore if the conditions are not met
        if (_userMaxAmount > 0 && contractBalanceBefore > 0 && _data.enabled == true) {
            if (userAlreadyClaimed < _userMaxAmount) {
                uint256 userBalanceBefore = _token.balanceOf(_userAddress);
                Debugger.log("userBalanceBefore", userBalanceBefore);
                // claim
                hevm.prank(_userAddress);
                try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
                    uint256 userBalanceAfter = _token.balanceOf(_userAddress);
                    uint256 contractBalanceAfter = _token.balanceOf(address(distribution));
                    // logs
                    Debugger.log("userBalanceAfter", userBalanceAfter);
                    Debugger.log("_contractBalanceAfter", contractBalanceAfter);
                    // test the invariants
                    assert(userBalanceAfter > userBalanceBefore);
                    assert(contractBalanceAfter < contractBalanceBefore);
                    // claimed ammount
                    uint256 claimedAmountUsingBalances = userBalanceAfter - userBalanceBefore;
                    uint256 claimedAmountUsingGetter = distribution.getWalletClaims(
                        _data.uuid,
                        _userAddress
                    );
                    assert(claimedAmountUsingGetter == claimedAmountUsingBalances);
                    assert(
                        contractBalanceBefore - claimedAmountUsingBalances == contractBalanceAfter
                    );
                    assert(claimedAmountUsingBalances <= _userMaxAmount);
                } catch {
                    // as all conditions for successful claiming are met, thus the claim should never fail
                    assert(false);
                }
            }
        }
    }

    // ////////////////////////////////////////
    // // Token and Distribution Consistency //
    // ////////////////////////////////////////

    // 2.1. The 'tokensDistributable' must always be less than or equal to 'tokensTotal' for any distribution.
    function tokensDistributableLteTokensTotal() public {
        DistributionData memory _data = getCurrentDistribution();

        Debugger.log("_data.tokensDistributable", _data.tokensDistributable);
        Debugger.log("_data.tokensTotal", _data.tokensTotal);

        assert(_data.tokensDistributable <= _data.tokensTotal);
    }

    // 2.2. The sum of all claimed tokens by individual wallets should never exceed the 'tokensDistributable' in a given distribution.
    function totalAmountClaimedLteTokensDistributable() public {
        DistributionData memory _data = getCurrentDistribution();
        if (distribution.getAlreadyClaimed(_data.uuid) > 0) {
            // sum all claimed tokens by users
            uint256 totalAmountClaimed;
            uint256 totalAmountClaimedByAccounting;
            for (uint8 i; i < _usersCounter; i++) {
                totalAmountClaimed += _getAmountClaimedByUser(i);
            }
            Debugger.log("_data.tokensDistributable", _data.tokensDistributable);
            Debugger.log("totalAmountClaimedByAccounting", totalAmountClaimedByAccounting);

            assert(totalAmountClaimedByAccounting <= _data.tokensDistributable);
        }
    }

    // 2.3. The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    function totalAmountClaimedLteTokensTotal() public {
        DistributionData memory _data = getCurrentDistribution();
        if (distribution.getAlreadyClaimed(_data.uuid) > 0) {
            // sum all claimed tokens by users
            uint256 totalAmountClaimed;
            for (uint8 i; i < _usersCounter; i++) {
                totalAmountClaimed += _getAmountClaimedByUser(i);
            }
            Debugger.log("_data.tokensTotal", _data.tokensTotal);
            Debugger.log("totalAmountClaimed", totalAmountClaimed);

            assert(totalAmountClaimed <= _data.tokensTotal);
        }
    }

    // 2.4. The sum of all claimed tokens by individual wallets must be equal to 'distributionClaimed[uuid]' in a given distribution.
    function totalAmountClaimedEqualsAlreadyClaimedTotal() public {
        DistributionData memory _data = getCurrentDistribution();
        uint256 alreadyClaimedTotal = distribution.getAlreadyClaimed(_data.uuid);
        // sum all claimed tokens by users
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        Debugger.log("totalAmountClaimed", totalAmountClaimed);
        Debugger.log("alreadyClaimedTotal", alreadyClaimedTotal);

        assert(totalAmountClaimed == alreadyClaimedTotal);
    }

    // HELPERS //

    function _getClaimableAmount(address _user) internal view returns (uint256) {
        DistributionData memory _data = getCurrentDistribution();
        if (_data.tokensDistributable < _data.tokensTotal) {
            uint256 userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _user);
            return (userMaxAmount * _data.tokensDistributable) / _data.tokensTotal;
        }
        return 0;
    }

    function _getAddressOfOrigin(address user) internal view returns (address) {
        // check if address has been redirected
        address originUser = distributionWalletChange.getWalletToFrom(user);
        // if address has not been redirected, return the user address
        address addressOfOrigin = originUser == address(0) ? user : originUser;
        return addressOfOrigin;
    }

    function _isAddressRedirectedFrom(address user) internal view returns (bool) {
        return distributionWalletChange.walletChangesFromTo(user) != address(0);
    }

    function _isAddressRedirectedTo(address user) internal view returns (bool) {
        return distributionWalletChange.walletChangesToFrom(user) != address(0);
    }
}
