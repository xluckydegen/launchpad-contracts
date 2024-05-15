// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { CheatCodes } from "./Interface.sol";
import { Distribution, DistributionData } from "contracts/v2/DistributionV2.sol";
import {
    DistributionWalletChange,
    WalletChangeData
} from "contracts/v2/DistributionWalletChangeV2.sol";
import { MockERC20 } from "contracts/echidna/MockERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { EchidnaMerkleHelpers } from "contracts/echidna/EchidnaMerkleHelpers.sol";

// SCENARIO: token Distribution
//
// - tokenPrice: 0.012 USD
// - vesting: 24 months
// - raised: 49_697 USD
//      - USER 1: 40_000 USD
//      - USER 2: 8_500 USD
//      - USER 3: 697 USD
//      - USER 4: 500 USD
// - totalTokens: 4_141_216 (raised/tokenPrice, rounded down)
// - maxAmounts: (userInvestment/tokenPrice, rounded down)
//      - USER 1: 3_333_333
//      - USER 2: 708_333
//      - USER 3: 58_083
//      - USER 4: 41_666
// - monthDistribution: 172_552 (totalTokens/vesting)

error DistributionTest__FromEqualsTo();

contract DistributionTest is Test {
    Distribution distribution;
    DistributionWalletChange distributionWalletChange;

    CheatCodes cheats = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    EchidnaMerkleHelpers merkleHelpers;
    MockERC20 token;

    uint256 public USER_MAX_AMOUNT_01 = 41_666;
    uint256 public USER_MAX_AMOUNT_02 = 58_083;
    uint256 public USER_MAX_AMOUNT_03 = 708_333;
    uint256 public USER_MAX_AMOUNT_04 = 3_333_333;

    uint256 public MONTH_DISTRIBUTION = 172_559;
    uint256 public vesting = 24; // months

    uint256 totalTokens;
    uint256 totalUsers;
    uint256 tokensDistributable;
    uint256 distributionEvents;

    uint256[] public maxAmounts;
    mapping(address => uint256) userToMaxAmount;

    function setUp() public {
        distributionWalletChange = new DistributionWalletChange();
        distribution = new Distribution(distributionWalletChange);
        merkleHelpers = new EchidnaMerkleHelpers();

        maxAmounts.push(USER_MAX_AMOUNT_01);
        maxAmounts.push(USER_MAX_AMOUNT_02);
        maxAmounts.push(USER_MAX_AMOUNT_03);
        maxAmounts.push(USER_MAX_AMOUNT_04);

        totalUsers = maxAmounts.length;
    }

    /// @notice test that all eligible users can always claim their tokens
    function testUserCanAlwaysClaim() public {
        _fixtureBase();
        // validate setup
        assertEq(totalTokens, merkleHelpers.tokensTotal());

        uint256 amountToBeDistributed = _getAmountToBeDistributed();
        // simulating each vesting distribution (i.e. monthly distributions)
        while (amountToBeDistributed > 0) {
            distributionEvents += 1;
            // increase and set tokensDistributable
            tokensDistributable += amountToBeDistributed;
            merkleHelpers.setTokensDistributable(tokensDistributable);
            // create distribution
            merkleHelpers.storeDistributionData();
            DistributionData memory distributionData = merkleHelpers.getCurrentDistributionData();
            distribution.storeDistribution(distributionData);
            // mint tokens and deposit them into distribution
            _mintTransferApproveTokens(amountToBeDistributed);
            distribution.depositTokensToDistribution(distributionData.uuid, amountToBeDistributed);
            // user claiming process
            for (uint8 i; i < totalUsers; i++) {
                address userAddress = merkleHelpers.getUserAddress(i);
                uint256 userMaxAmount = userToMaxAmount[userAddress];
                bytes32[] memory userProof = merkleHelpers.getUserProofByUserId(
                    i,
                    distributionData.merkleRoot
                );

                uint256 userBalanceBefore = token.balanceOf(userAddress);
                cheats.prank(userAddress);
                distribution.claim(distributionData.uuid, userMaxAmount, userProof);
                uint256 userBalanceAfter = token.balanceOf(userAddress);

                assertTrue(userBalanceAfter > userBalanceBefore);
            }
            // update `amountToBeDistributed`
            amountToBeDistributed = _getAmountToBeDistributed();
        }
        // check overall user balances after all distribution events
        for (uint8 i; i < totalUsers; i++) {
            address userAddress = merkleHelpers.getUserAddress(i);
            uint256 totalUserBalance = token.balanceOf(userAddress);
            assertEq(totalUserBalance, userToMaxAmount[userAddress]);
        }
        // check the number of distribution events matches with the vesting
        assertEq(distributionEvents, vesting);
    }

    function testWalletClaimIsAlwaysLowerThanMaxAmount() public {
        _fixtureFullDeposit();
        DistributionData memory distributionData = merkleHelpers.getCurrentDistributionData();
        // claims
        for (uint8 i; i < totalUsers; i++) {
            address userAddress = merkleHelpers.getUserAddress(i);
            uint256 userMaxAmount = userToMaxAmount[userAddress];
            bytes32[] memory userProof = merkleHelpers.getUserProofByUserId(
                i,
                distributionData.merkleRoot
            );
            cheats.prank(userAddress);
            distribution.claim(distributionData.uuid, userMaxAmount, userProof);
            uint256 claimedAmount = distribution.getWalletClaims(
                distributionData.uuid,
                userAddress
            );
            assertEq(claimedAmount, userMaxAmount);
        }
    }

    function testWalletCannotClaimMoreThanMaxAmount() public {
        _fixtureFullDeposit();
        DistributionData memory distributionData = merkleHelpers.getCurrentDistributionData();
        // claims
        for (uint8 i; i < totalUsers; i++) {
            address userAddress = merkleHelpers.getUserAddress(i);
            uint256 userMaxAmount = userToMaxAmount[userAddress];
            bytes32[] memory userProof = merkleHelpers.getUserProofByUserId(
                i,
                distributionData.merkleRoot
            );
            // the first claim to claim all tokens
            cheats.prank(userAddress);
            distribution.claim(distributionData.uuid, userMaxAmount, userProof);
            // the second claim -> should revert as the user is not eligible to mint more tokens
            cheats.expectRevert();
            cheats.prank(userAddress);
            distribution.claim(distributionData.uuid, userMaxAmount, userProof);
        }
    }

    function testWalletRedirectedFromCannotClaimAnymore() public {
        _fixtureFullDeposit();
        DistributionData memory distributionData = merkleHelpers.getCurrentDistributionData();
        // redirection
        uint8 _userId = 0;
        address userListed = merkleHelpers.getUserAddress(_userId);
        address userNotListed = makeAddr("NotListed");
        WalletChangeData memory walletChangeData = _createWalletChangeData(userListed, userNotListed);
        distributionWalletChange.storeWalletChange(walletChangeData);
        // claims
        uint256 userMaxAmount = userToMaxAmount[userListed];
        bytes32[] memory userProof = merkleHelpers.getUserProofByUserId(
            _userId,
            distributionData.merkleRoot
        );
        cheats.expectRevert();
        cheats.prank(userListed);
        distribution.claim(distributionData.uuid, userMaxAmount, userProof);
    }

    //////////////////////
    // INTERNAL HELPERS //
    //////////////////////

    function _fixtureBase() internal {
        // create users and update internal accounting
        for (uint8 i; i < totalUsers; i++) {
            uint256 userMaxAmount = maxAmounts[i];
            merkleHelpers.createUser(userMaxAmount);
            address userAddress = merkleHelpers.getUserAddress(i);
            userToMaxAmount[userAddress] = userMaxAmount;
            totalTokens += userMaxAmount;
        }

        merkleHelpers.setToken(0);
        merkleHelpers.enableDistribution(true);
        token = merkleHelpers.tokens(0);
    }

    function _fixtureFullDeposit() internal {
        _fixtureBase();
        uint256 dealMaxAmount = MONTH_DISTRIBUTION * vesting - 1; // NOTE: -1 because of rounding error
        merkleHelpers.setTokensDistributable(dealMaxAmount);
        // create distribution
        merkleHelpers.storeDistributionData();
        DistributionData memory distributionData = merkleHelpers.getCurrentDistributionData();
        distribution.storeDistribution(distributionData);
        // deposit tokens
        _mintTransferApproveTokens(dealMaxAmount);
        distribution.depositTokensToDistribution(distributionData.uuid, dealMaxAmount);
    }

    function _getAmountToBeDistributed() internal view returns (uint256) {
        uint256 amountToBeDistributed = totalTokens - tokensDistributable >= MONTH_DISTRIBUTION
            ? MONTH_DISTRIBUTION
            : totalTokens - tokensDistributable;
        return amountToBeDistributed;
    }

    function _mintTransferApproveTokens(uint256 amount) internal {
        merkleHelpers.mintTokenToDistributor(0, amount);
        cheats.prank(address(merkleHelpers));
        token.transfer(address(this), amount);
        token.approve(address(distribution), amount);
    }

    function _createWalletChangeData(
        address _from,
        address _to
    ) internal pure returns (WalletChangeData memory) {
        if (_from == _to) revert DistributionTest__FromEqualsTo();
        WalletChangeData memory _dataToReturn = WalletChangeData({
            uuid: "TEST_WALLET_CHANGE",
            walletFrom: _from,
            walletTo: _to,
            createdAt: 0,
            updatedAt: 0,
            deletedAt: 0,
            signature: "",
            message: ""
        });
        return _dataToReturn;
    }
}
