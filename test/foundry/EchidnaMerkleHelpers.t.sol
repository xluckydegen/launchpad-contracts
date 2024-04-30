// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CheatCodes } from "./Interface.sol";
import { EchidnaMerkleHelpers } from "contracts/echidna/EchidnaMerkleHelpers.sol";
import { MockERC20 } from "contracts/echidna/MockERC20.sol";
import { Distribution, DistributionData, IERC20 } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";

bytes4 constant selector_EchidnaMerkleHelpers_NoUserExists = bytes4(
    keccak256("EchidnaMerkleHelpers__NoUserExists()")
);
bytes4 constant selector_EchidnaMerkleHelpers__UserDoesNotExist = bytes4(
    keccak256("EchidnaMerkleHelpers__UserDoesNotExist()")
);
bytes4 constant selector_EchidnaMerkleHelpers__MaxUsersReached = bytes4(
    keccak256("EchidnaMerkleHelpers__MaxUsersReached()")
);
bytes4 constant selector_Distribution_NotEnoughTokens = bytes4(
    keccak256("Distribution__NotEnoughTokens()")
);
bytes4 constant selector_Distribution_NothingToClaim = bytes4(
    keccak256("Distribution_NothingToClaim()")
);

// forge test --match-contract TestEchidnaMerkleHelpers
contract TestEchidnaMerkleHelpers is Test {
    EchidnaMerkleHelpers helpers;
    CheatCodes cheats = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    // address OWNER;

    uint8 USER_01_ID = 0;
    uint8 USER_02_ID = 1;
    uint8 USER_03_ID = 2;
    uint8 USER_04_ID = 3;

    uint256 USER_01_AMOUNT = 1000;
    uint256 USER_02_AMOUNT = 2000;
    uint256 USER_03_AMOUNT = 3000;
    uint256 USER_04_AMOUNT = 4000;

    function setUp() public {
        distributionWalletChange = new DistributionWalletChange();
        distribution = new Distribution(distributionWalletChange);
        helpers = new EchidnaMerkleHelpers();
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
        uint256 userMaxAmount = helpers.getUserMaxAmount(USER_01_ID);
        assertEq(userMaxAmount, USER_01_AMOUNT);
        uint256 totalTokens = helpers.tokensTotal();
        assertEq(totalTokens, USER_01_AMOUNT);
        // create another user
        helpers.createUser(USER_02_AMOUNT);
        uint8 userCounterAfterSecondUser = helpers._usersCounter();
        assertEq(userCounterAfterSecondUser, 2);
        uint256 userMaxAmountSecondUser = helpers.getUserMaxAmount(USER_02_ID);
        assertEq(userMaxAmountSecondUser, USER_02_AMOUNT);
        uint256 totalTokensAfterSecondUser = helpers.tokensTotal();
        assertEq(totalTokensAfterSecondUser, USER_01_AMOUNT + USER_02_AMOUNT);
    }

    function test_createUserCapacityReached() public {
        helpers.createUser(USER_01_AMOUNT);
        helpers.createUser(USER_02_AMOUNT);
        helpers.createUser(USER_03_AMOUNT);
        helpers.createUser(USER_04_AMOUNT);
        cheats.expectRevert(selector_EchidnaMerkleHelpers__MaxUsersReached);
        helpers.createUser(5000);
    }

    function test_updateUserMaxAmount() public {
        // revert case -> no user exists
        cheats.expectRevert(selector_EchidnaMerkleHelpers__UserDoesNotExist);
        helpers.updateUserMaxAmount(USER_01_ID, USER_01_AMOUNT);

        helpers.createUser(USER_01_AMOUNT);
        uint256 maxAmountBefore = helpers.getUserMaxAmount(USER_01_ID);
        assertEq(maxAmountBefore, USER_01_AMOUNT);

        helpers.updateUserMaxAmount(USER_01_ID, 2000);
        uint256 maxAmountAfter = helpers.getUserMaxAmount(USER_01_ID);
        assertEq(maxAmountAfter, 2000);

        helpers.updateUserMaxAmount(USER_01_ID, 3000);
        uint256 maxAmountAfterModulo = helpers.getUserMaxAmount(USER_01_ID);
        assertEq(maxAmountAfterModulo, 3000);

        uint256 totalTokens = helpers.tokensTotal();
        assertEq(totalTokens, 3000);
    }

    function test_createNewToken() public {
        // before
        uint8 tokenCounterBefore = helpers._tokensCounter();
        assertEq(tokenCounterBefore, 1);

        MockERC20 oldToken = helpers.tokens(tokenCounterBefore - 1);
        string memory oldTokenName = oldToken.name();
        assertEq(oldTokenName, "Token_0");

        // act
        helpers.createNewToken();

        // after
        uint8 tokenCounterAfter = helpers._tokensCounter();
        assertEq(tokenCounterAfter, 2);

        MockERC20 newToken = helpers.tokens(tokenCounterAfter - 1);
        string memory tokenName = newToken.name();
        assertEq(tokenName, "Token_1");
    }

    function test_setToken() public {
        MockERC20 currentToken = helpers.currentToken();
        assertEq(address(currentToken), address(0));

        MockERC20 token = helpers.tokens(0);
        string memory tokenName = token.name();
        assertEq(tokenName, "Token_0");

        helpers.setToken(0);
        MockERC20 newCurrentToken = helpers.currentToken();
        assertEq(address(newCurrentToken), address(token));
    }

    function test_mintTokensToUser() public {
        // arrange
        MockERC20 token = helpers.tokens(0);
        helpers.createUser(USER_01_AMOUNT);
        address userAddress = helpers.getUserAddress(USER_01_ID);
        uint256 userBalanceBefore = token.balanceOf(userAddress);
        assertEq(userBalanceBefore, 0);
        // act
        helpers.mintTokensToUser(USER_01_ID, 0, 100);
        // assert
        uint256 userBalanceAfter = token.balanceOf(userAddress);
        assertEq(userBalanceAfter, 100);
    }

    function test_createNewTokenAndMintTokensUser() public {
        // arrange
        helpers.createNewToken();
        MockERC20 newToken = helpers.tokens(1);
        helpers.createUser(1000);
        address userAddress = helpers.getUserAddress(USER_01_ID);

        uint256 userBalanceBefore = newToken.balanceOf(userAddress);
        assertEq(userBalanceBefore, 0);

        // fail
        cheats.expectRevert(selector_EchidnaMerkleHelpers__UserDoesNotExist);
        helpers.mintTokensToUser(USER_02_ID, 1, 100);
        // success
        helpers.mintTokensToUser(USER_01_ID, 1, 100);

        // assert
        uint256 userBalanceAfter = newToken.balanceOf(userAddress);
        assertEq(userBalanceAfter, 100);

        MockERC20 oldToken = helpers.tokens(0);
        uint256 userBalanceOldToken = oldToken.balanceOf(userAddress);
        assertEq(userBalanceOldToken, 0);
    }

    function test_setTokensDistributable() public {
        helpers.setTokensDistributable(1000);
        assertEq(1000, helpers.tokensDistributable());
    }

    function test_enableDistribution() public {
        helpers.enableDistribution(true);
        assertEq(true, helpers.distributionEnabled());
    }

    ////////////////////////////////////////////////////
    // DISTRIBUTION DATA CREATION - INTEGRATION TESTS //
    ////////////////////////////////////////////////////

    function _createTestCase01() internal {
        helpers.createUser(USER_01_AMOUNT);
        helpers.createUser(USER_02_AMOUNT);
        helpers.createUser(USER_03_AMOUNT);
        helpers.setToken(0);
        helpers.enableDistribution(true);
        helpers.storeDistributionData();
    }

    function test_storeDistributionData() public {
        _createTestCase01();
        DistributionData memory distributionData = helpers.getCurrentDistributionData();

        assertEq(distributionData.enabled, true);
        assertEq(distributionData.tokensTotal, 6000);
        assertEq(distributionData.tokensDistributable, 0);
    }

    function test_usersByMerkleRoot() public {
        _createTestCase01();
        DistributionData memory distributionData = helpers.getCurrentDistributionData();

        bytes32 merkleRoot = distributionData.merkleRoot;

        address userOneAddress = helpers.getUserAddress(USER_01_ID);
        uint256 userOneMaxAmount = helpers.getUsersMaxAmountByMerkleRoot(
            merkleRoot,
            userOneAddress
        );
        assertEq(userOneMaxAmount, USER_01_AMOUNT);

        address userTwoAddress = helpers.getUserAddress(USER_02_ID);
        uint256 userTwoMaxAmount = helpers.getUsersMaxAmountByMerkleRoot(
            merkleRoot,
            userTwoAddress
        );
        assertEq(userTwoMaxAmount, USER_02_AMOUNT);

        address userThreeAddress = helpers.getUserAddress(USER_03_ID);
        uint256 userThreeMaxAmount = helpers.getUsersMaxAmountByMerkleRoot(
            merkleRoot,
            userThreeAddress
        );
        assertEq(userThreeMaxAmount, USER_03_AMOUNT);
    }

    /// @dev instead of testing the Merkle Root and Proofs generation by differential testing approach
    /// the integration test is performed here
    /// @dev this is just a sanity check as differential testing has been already done for Murky and OZ library for Merkle library:
    /// https://github.com/dmfxyz/murky/tree/main/differential_testing
    function test_MerkleValidity() public {
        _createTestCase01();
        DistributionData memory distributionData = helpers.getCurrentDistributionData();
        MockERC20 token = helpers.tokens(0);
        // store new distribution
        distribution.storeDistribution(distributionData);
        string memory distributionUUID = distributionData.uuid;
        // arrange users
        address userAddressOne = helpers.getUserAddress(USER_01_ID);
        bytes32[] memory userProof = helpers.getUserProof(USER_01_ID, distributionData.merkleRoot);
        //  TEST: no one can claim
        cheats.startPrank(address(userAddressOne));
        cheats.expectRevert(selector_Distribution_NothingToClaim);
        distribution.claim(distributionUUID, 1000, userProof);
        cheats.stopPrank();
        // TEST: successful claim
        // mint tokens to distributor
        helpers.mintTokenToDistributor(0, distributionData.tokensTotal);
        cheats.prank(address(helpers));
        token.transfer(address(this), distributionData.tokensTotal);
        uint256 adminBalance = token.balanceOf(address(this));
        assertEq(adminBalance, distributionData.tokensTotal);
        // adjust distribution data
        distributionData.tokensDistributable = distributionData.tokensTotal;
        // store changed distribution data
        distribution.storeDistribution(distributionData);
        token.approve(address(distribution), distributionData.tokensTotal);
        distribution.depositTokensToDistribution(distributionUUID, distributionData.tokensTotal);

        // user claim
        cheats.prank(userAddressOne);
        distribution.claim(distributionUUID, 1000, userProof);
    }
}
