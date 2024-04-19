// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {CheatCodes} from "./Interface.sol";
import {EchidnaHelpersSimple} from "contracts/echidna/EchidnaHelpersSimple.sol";
import {MockERC20} from "contracts/echidna/MockERC20.sol";
import {Distribution, DistributionData} from "contracts/v2/DistributionV2.sol";
import {DistributionWalletChange} from "contracts/v2/DistributionWalletChangeV2.sol";

bytes4 constant selector_EchidnaHelpers__NoUserExists = bytes4(keccak256("EchidnaHelpers__NoUserExists()"));
bytes4 constant selector_Distribution_NotEnoughTokens = bytes4(keccak256("Distribution__NotEnoughTokens()"));
bytes4 constant selector_Distribution_NothingToClaim = bytes4(keccak256("Distribution_NothingToClaim()"));

// forge test --match-contract TestEchidnaHelpersSimple
contract TestEchidnaHelpersSimple is Test {
    EchidnaHelpersSimple helpers;
    CheatCodes cheats = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    address DISTRIBUTION_ADMIN;

    function setUp() public {
        helpers = new EchidnaHelpersSimple();
        DISTRIBUTION_ADMIN = helpers.defaultAdmin();
        // deploy distribution as its admin
        cheats.startPrank(DISTRIBUTION_ADMIN);
        distributionWalletChange = new DistributionWalletChange();
        distribution = new Distribution(distributionWalletChange);
        cheats.stopPrank();
    }

    function test_initUserCounter() public view {
        uint256 userCounter = helpers._usersCounter();
        assertEq(userCounter, 0);
    }

    function testInitTokenCreation() public view {
        uint8 tokenCounter = helpers._tokensCounter();
        assertEq(tokenCounter, 1);
    }

    function test_createUser() public {
        // validate no user exists
        uint8 userCounterBefore = helpers._usersCounter();
        assertEq(userCounterBefore, 0);
        // create user
        helpers.createUser(1000);
        // validate user exists
        uint8 userCounterAfter = helpers._usersCounter();
        assertEq(userCounterAfter, 1);
        address userAddress = helpers.getUserAddress(1);
        assertEq(userAddress, address(uint160(1)));
        uint256 userMaxAmount = helpers.getUserMaxAmount(1);
        assertEq(userMaxAmount, 1000);
        uint256 totalTokens = helpers._tokensTotal();
        assertEq(totalTokens, 1000);
    }

    function test_updateUserMaxAmount() public {
        // revert case -> no user exists
        cheats.expectRevert(selector_EchidnaHelpers__NoUserExists);
        helpers.updateUserMaxAmount(1, 3000);

        helpers.createUser(1000);
        uint256 maxAmountBefore = helpers.getUserMaxAmount(1);
        assertEq(maxAmountBefore, 1000);

        helpers.updateUserMaxAmount(1, 2000);
        uint256 maxAmountAfter = helpers.getUserMaxAmount(1);
        assertEq(maxAmountAfter, 2000);

        helpers.updateUserMaxAmount(2, 3000);
        uint256 maxAmountAfterModulo = helpers.getUserMaxAmount(1);
        assertEq(maxAmountAfterModulo, 3000);

        uint256 totalTokens = helpers._tokensTotal();
        assertEq(totalTokens, 3000);
    }

    function test_createNewToken() public {
        // before
        uint8 tokenCounterBefore = helpers._tokensCounter();
        assertEq(tokenCounterBefore, 1);
        // act
        helpers.createNewToken();
        // after
        uint8 tokenCounterAfter = helpers._tokensCounter();
        assertEq(tokenCounterAfter, 2);

        MockERC20 token = helpers.getToken(tokenCounterAfter);
        string memory tokenName = token.name();
        assertEq(tokenName, "Token_2");
    }

    function test_mintTokens() public {
        // arrange
        MockERC20 token = helpers.getToken(1);
        helpers.createUser(1000);
        address userAddress = helpers.getUserAddress(1);
        uint256 userBalanceBefore = token.balanceOf(userAddress);
        assertEq(userBalanceBefore, 0);
        // act
        helpers.mintTokens(1, 100);
        // assert
        uint256 userBalanceAfter = token.balanceOf(userAddress);
        assertEq(userBalanceAfter, 100);
    }

    function test_createNewTokenAndMintTokens() public {
        // arrange
        helpers.createNewToken();
        MockERC20 newToken = helpers.getToken(2);
        helpers.createUser(1000);
        address userAddress = helpers.getUserAddress(1);

        uint256 userBalanceBefore = newToken.balanceOf(userAddress);
        assertEq(userBalanceBefore, 0);

        // act
        helpers.mintTokens(1, 100);

        // assert
        uint256 userBalanceAfter = newToken.balanceOf(userAddress);
        assertEq(userBalanceAfter, 100);

        MockERC20 oldToken = helpers.getToken(1);
        uint256 userBalanceOldToken = oldToken.balanceOf(userAddress);
        assertEq(userBalanceOldToken, 0);
    }

    function test_setTokensDistributable() public {
        helpers.setTokensDistributable(1000);
        assertEq(1000, helpers._tokensDistributable());
    }

    function test_enableDistribution() public {
        helpers.enableDistribution(true);
        assertEq(true, helpers._distributionEnabled());
    }

    ////////////////////////////////////////////////////
    // DISTRIBUTION DATA CREATION - INTEGRATION TESTS //
    ////////////////////////////////////////////////////

    function _createTestCase01() internal {
        helpers.createUser(1000);
        helpers.createUser(2000);
        helpers.createUser(3000);
        helpers.enableDistribution(true);
        helpers.storeDistributionData();
    }

    function test_storeDistributionData() public {
        _createTestCase01();
        DistributionData memory distributionData = helpers.getCurrentDistribution();

        assertEq(distributionData.enabled, true);
        assertEq(distributionData.tokensTotal, 6000);
        assertEq(distributionData.tokensDistributable, 0);
    }

    /// @dev instead of testing the Merkle Root and Proofs generation by differential testing approach
    /// the integration test is performed here
    /// @dev this is just a sanity check as differential testing has been already done for Murky and OZ library for Merkle library:
    /// https://github.com/dmfxyz/murky/tree/main/differential_testing
    function test_MerkleValidity() public {
        _createTestCase01();
        DistributionData memory distributionData = helpers.getCurrentDistribution();
        MockERC20 token = helpers.getToken(1);
        // store new distribution
        cheats.prank(DISTRIBUTION_ADMIN);
        distribution.storeDistribution(distributionData);
        string memory distributionUUID = distributionData.uuid;
        // arrange users
        address userAddressOne = helpers.getUserAddress(1);
        bytes32[] memory userProof = helpers.getUserProof(1);
        //  TEST: no one can claim
        cheats.startPrank(address(userAddressOne));
        cheats.expectRevert(selector_Distribution_NothingToClaim);
        distribution.claim(distributionUUID, 1000, userProof);
        cheats.stopPrank();
        // TEST: successful claim
        // mint tokens to distributor
        helpers.mintTokens(0, distributionData.tokensTotal);
        uint256 adminBalance = token.balanceOf(DISTRIBUTION_ADMIN);
        assertEq(adminBalance, distributionData.tokensTotal);
        // adjust distribution data
        distributionData.tokensDistributable = distributionData.tokensTotal;
        // store changed distribution data
        cheats.startPrank(DISTRIBUTION_ADMIN);
        distribution.storeDistribution(distributionData);
        token.approve(address(distribution), distributionData.tokensTotal);
        distribution.depositTokensToDistribution(distributionUUID, distributionData.tokensTotal);
        cheats.stopPrank();
        // user claim
        cheats.prank(userAddressOne);
        distribution.claim(distributionUUID, 1000, userProof);
    }
}
