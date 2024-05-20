// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CheatCodes } from "./Interface.sol";
import { EchidnaHelpers } from "contracts/echidna/EchidnaHelpers.sol";
import { WalletChangeData } from "contracts/v2/DistributionWalletChangeV2.sol";
import { PropertiesLibString } from "contracts/echidna/PropertiesHelpers.sol";
import { Distribution, DistributionData, IERC20 } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";

contract TestEchidnaHelpers is Test {
    EchidnaHelpers helpers;
    CheatCodes cheats = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint8 USER_01_ID = 0;
    uint8 USER_02_ID = 1;
    uint8 USER_03_ID = 2;
    uint8 USER_04_ID = 3;

    uint256 USER_01_AMOUNT = 1000;
    uint256 USER_02_AMOUNT = 2000;
    uint256 USER_03_AMOUNT = 3000;
    uint256 USER_04_AMOUNT = 4000;

    function setUp() public {
        helpers = new EchidnaHelpers();
    }

    function testStoreWalletChange() public {
        // add wallet change
        helpers.storeWalletChange(USER_01_ID, USER_02_ID);
        address _userOneAddress = helpers.getUserAccount(USER_01_ID);
        address _userTwoAddress = helpers.getUserAccount(USER_02_ID);
        string memory _walletChangeUuid = PropertiesLibString.toString(_userOneAddress);
        WalletChangeData memory _walletChange = helpers.getWalletChange(_walletChangeUuid);
        assertEq(_walletChange.walletFrom, _userOneAddress);
        assertEq(_walletChange.walletTo, _userTwoAddress);
        assertEq(helpers.getWalletFromTo(_userOneAddress), _userTwoAddress);
        assertEq(helpers.getWalletToFrom(_userTwoAddress), _userOneAddress);
        assertEq(helpers.getWalletChangeCount(), 1);

        // remove the wallet change
        helpers.removeWalletChange(0);
        WalletChangeData memory _walletChangeAfterRemoval = helpers.getWalletChange(
            _walletChangeUuid
        );
        assertEq(helpers.getWalletFromTo(_userOneAddress), address(0));
        assertEq(helpers.getWalletToFrom(_userTwoAddress), address(0));
        assertTrue(_walletChangeAfterRemoval.deletedAt != 0);
    }

    function test_validateDistributionData() public {
        helpers.createUser(USER_01_AMOUNT);
        helpers.createUser(USER_02_AMOUNT);
        helpers.createUser(USER_03_AMOUNT);
        helpers.setToken(0);
        helpers.enableDistribution(true);
        helpers.storeDistributionData();
        helpers.storeDistribution();

        DistributionData memory _currentDistribution = helpers.getCurrentDistribution();

        assertFalse(address(_currentDistribution.token) == address(0));
        IERC20 _token = _currentDistribution.token;

        address _userOneAddress = helpers.getUserAccount(USER_01_ID);
        uint256 _userBalance = _token.balanceOf(address(_userOneAddress));
        assertEq(_userBalance, 0);
    }
}
