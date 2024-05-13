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

/**
 * @title Fuzzing Campaign to test invariants
 */
contract EchidnaTestDistribution is EchidnaHelpers {
    constructor() {}

    /////////////////////////////////
    // Claims and Claiming Process //
    /////////////////////////////////

    // 1.1. Users cannot claim more tokens than `maxAmount`
    // -> invariant check via accounting
    function usersCannotClaimMoreTokensThanMaxAmount() public {
        DistributionData memory _data = getCurrentDistribution();
        string memory _uuid = _data.uuid;
        uint256 alreadyClaimedAmount = distribution.getAlreadyClaimed(_uuid);
        if (alreadyClaimedAmount > 0) {
            bytes32 _merkleRoot = _data.merkleRoot;
            for (uint8 i; i < _usersCounter; i++) {
                address userAddress = users[i].userAddress;
                uint256 userMaxAmountByMerkle = getUsersMaxAmountByMerkleRoot(
                    _merkleRoot,
                    userAddress
                );
                uint256 userAmountClaimed = distribution.getWalletClaims(_uuid, userAddress);

                Debugger.log("userAddress", userAddress);
                Debugger.log("userAmountClaimed", userAmountClaimed);
                Debugger.log("userMaxAmountByMerkle", userMaxAmountByMerkle);

                assert(userAmountClaimed <= userMaxAmountByMerkle);
            }
        }
    }

    // 1.1. User cannot claim more tokens than their `maxAmount`
    // -> invariant check via function call
    function userCannotClaimIfAlreadyClaimedMaxAmount(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();
        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        if (_data.enabled == false) revert EchidnaTestDistribution_Paused();

        IERC20 _token = _data.token;
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProofByUserId(_userId, _data.merkleRoot);

        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 userAlreadyClaimed = distribution.getWalletClaims(_data.uuid, _userAddress);

        // NOTE: changing from `_contractBalanceBefore == 0` to `_contractBalanceBefore > 0` in order to test
        // that user cannot gain more tokens than `maxAmount`
        if (_contractBalanceBefore > 0 && userAlreadyClaimed >= _userMaxAmount) {
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
                Debugger.log("userClaimedTotal", userClaimedTotal);
                Debugger.log("_userMaxAmount", _userMaxAmount);

                assert(userClaimedTotal < _userMaxAmount);
            }
        }
    }

    // 1.7 a wallet which funds has been redirected from cannot claim anymore
    function redirectedWalletCannotClaimAnymore(uint8 _userId) public {
        address userAddress = getUserAddress(_userId);
        if (_isAddressRedirected(userAddress)) {
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

    // 1.6 User can always claim if eligible 
    function userCanClaim(uint8 _userId) public {
        // TODO remove
        if (_usersCounter != 4) revert EchidnaTestDistribution_NotEnoughUsers(); 
        // be sure that emergency pause has not been activated
        distribution.emergencyDistributionsPause(false);
        DistributionData memory _data = getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        if (_isAddressRedirected(_userAddress)) {
            // if address has been redirected, address is not supposed to claim anymore, thus reverting
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
        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        // does not make sense to test anymore if:
        if (_userMaxAmount > 0 && _contractBalanceBefore > 0 && _data.enabled == true) {
            uint256 alreadyClaimed = distribution.getWalletClaims(_data.uuid, _userAddress);
            if (alreadyClaimed < _userMaxAmount) {
                uint256 userBalanceBefore = _token.balanceOf(_userAddress);
                // claim
                hevm.prank(_userAddress);
                try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
                    // pass
                } catch {
                    Debugger.log("userAddress", _userAddress);
                    Debugger.log("addressWithValidProof", addressWithValidProof);
                    Debugger.log("alreadyClaimed", alreadyClaimed);
                    Debugger.log("userMaxAmount", _userMaxAmount);
                    Debugger.log("userBalanceBefore", userBalanceBefore);
                    assert(false);
                }
                uint256 userBalanceAfter = _token.balanceOf(_userAddress);

                Debugger.log("userAddress", _userAddress);
                Debugger.log("addressWithValidProof", addressWithValidProof);
                Debugger.log("alreadyClaimed", alreadyClaimed);
                Debugger.log("userMaxAmount", _userMaxAmount);
                Debugger.log("userBalanceBefore", userBalanceBefore);
                Debugger.log("userBalanceAfter", userBalanceAfter);

                assert(userBalanceAfter > userBalanceBefore);
            }
        }
    }

    // 1.4. User's token balance must always increase after successful claim.
    // 1.5. Distribution's token balance must always decrease after successful claim.
    // 2.4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.
    function userBalanceMustIncreaseAfterSuccessfulClaim(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();
        // data validation
        if (_usersCounter != 3) revert EchidnaTestDistribution_NotEnoughUsers(); // TODO remove
        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        if (_data.enabled == false) revert EchidnaTestDistribution_Paused();
        // token
        IERC20 _token = _data.token;
        // user
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProofByUserId(_userId, _data.merkleRoot);
        // balances
        uint256 _userBalanceBefore = _token.balanceOf(_userAddress);
        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 _alreadyClaimedByUser = distribution.getWalletClaims(_data.uuid, _userAddress);

        if (_alreadyClaimedByUser < _userMaxAmount) {
            if (_contractBalanceBefore == 0) {
                // mint tokens to have always something to be claimed
                uint256 alreadyDeposited = distribution.getAlreadyDeposited(_data.uuid);
                // uint256 tokensTotal = _data.tokensTotal;
                uint256 tokensToMint = _data.tokensTotal > alreadyDeposited
                    ? _data.tokensTotal - alreadyDeposited
                    : 0;
                Debugger.log("tokensToMint", tokensToMint);
                // user has not minted all tokens yet, thus `tokensToMint` must be always positive
                assert(tokensToMint > 0);
                depositTokensToDistribution(tokensToMint);
                // update contractBalance before
                _contractBalanceBefore = _token.balanceOf(address(distribution));
                assert(_contractBalanceBefore > 0);
            }
            Debugger.log("_userAddress", _userAddress);
            Debugger.log("_userMaxAmount", _userMaxAmount);
            Debugger.log("_alreadyClaimedByUser", _alreadyClaimedByUser);
            Debugger.log("_token.address", address(_token));
            Debugger.log("_contractBalanceBefore", _contractBalanceBefore);
            Debugger.log("_userBalanceBefore", _userBalanceBefore);

            hevm.prank(_userAddress);
            // distribution.claim(_data.uuid, _userMaxAmount, _userProof);
            try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
                uint256 _userBalanceAfter = _token.balanceOf(_userAddress);
                uint256 _contractBalanceAfter = _token.balanceOf(address(distribution));
                
                Debugger.log("_userBalanceAfter", _userBalanceAfter);
                Debugger.log("_contractBalanceAfter", _contractBalanceAfter);

                assert(_userBalanceAfter > _userBalanceBefore);
                assert(_contractBalanceAfter < _contractBalanceBefore);

                uint256 claimedAmount = _userBalanceAfter - _userBalanceBefore;
                
                assert(_contractBalanceBefore - claimedAmount == _contractBalanceAfter);
                assert(claimedAmount <= _userMaxAmount);
            } catch {
                // assert(false);
            }

            
        }
    }

    ////////////////////////////////////////
    // Token and Distribution Consistency //
    ////////////////////////////////////////

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
        // sum all claimed tokens by users
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        Debugger.log("_data.tokensDistributable", _data.tokensDistributable);
        Debugger.log("totalAmountClaimed", totalAmountClaimed);

        assert(totalAmountClaimed <= _data.tokensDistributable);
    }

    // 2.3. The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    function totalAmountClaimedLteTokensTotal() public {
        DistributionData memory _data = getCurrentDistribution();
        // sum all claimed tokens by users
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        Debugger.log("_data.tokensTotal", _data.tokensTotal);
        Debugger.log("totalAmountClaimed", totalAmountClaimed);

        assert(totalAmountClaimed <= _data.tokensTotal);
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

    function _getAddressOfOrigin(address user) internal view returns (address) {
        // check if address has been redirected
        address originUser = distributionWalletChange.getWalletToFrom(user);
        // if address has not been redirected, return the user address
        address addressOfOrigin = originUser == address(0) ? user : originUser;
        return addressOfOrigin;
    }

    function _isAddressRedirected(address user) internal view returns (bool) {
        return distributionWalletChange.walletChangesFromTo(user) != address(0);
    }
}
