import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "../wallets.test";

describe("App/V2/Behaviors/EmergencyWithdraw", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);

    const factoryTestEmergencyWithdraw = await hre.ethers.getContractFactory("TestEmergencyWithdraw");
    const contractTestEmergencyWithdraw = await factoryTestEmergencyWithdraw.deploy();

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const tokenUSDC = await factoryToken.deploy("USDC", 6);

    return {
      contractTestEmergencyWithdraw,
      tokenUSDC,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  it("deposit and withdraw ETH", async () =>
  {
    const fixt = await fixture();

    const addressContract = fixt.contractTestEmergencyWithdraw.getAddress();

    const balanceOwnerBefore = await ethers.provider.getBalance(fixt.walletOwner);

    await fixt.walletOwner.sendTransaction({
      to: addressContract,
      value: ethers.parseUnits('10', 'ether')
    });

    const balanceContract = await ethers.provider.getBalance(addressContract);
    expect(balanceContract / 10n ** 18n).eq(10);

    const balanceOwner = await ethers.provider.getBalance(fixt.walletOwner);
    expect(balanceOwner / 10n ** 18n).closeTo(9989,5);

    await fixt.contractTestEmergencyWithdraw.emergencyEthWithdraw();

    const balanceContractAfter = await ethers.provider.getBalance(addressContract);
    expect(balanceContractAfter).eq(0);

    const balanceOwnerAfter = await ethers.provider.getBalance(fixt.walletOwner);
    expect(balanceOwnerAfter / 10n ** 18n).eq(balanceOwnerBefore / 10n ** 18n);
  });

  it("deposit and withdraw ETH nonowner", async () =>
  {
    const fixt = await fixture();

    const addressContract = fixt.contractTestEmergencyWithdraw.getAddress();

    const balanceOwnerBefore = await ethers.provider.getBalance(fixt.walletOwner);

    await fixt.walletOwner.sendTransaction({
      to: addressContract,
      value: ethers.parseUnits('10', 'ether')
    });

    const balanceContract = await ethers.provider.getBalance(addressContract);
    expect(balanceContract / 10n ** 18n).eq(10);

    const balanceOwner = await ethers.provider.getBalance(fixt.walletOwner);
    expect(balanceOwner / 10n ** 18n).closeTo(9989,5);

    await expect(fixt.contractTestEmergencyWithdraw.connect(fixt.wallet1).emergencyEthWithdraw())
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("deposit and withdraw Token", async () =>
  {
    const fixt = await fixture();

    const addressContract = fixt.contractTestEmergencyWithdraw.getAddress();

    const balanceOwnerBefore = await fixt.tokenUSDC.balanceOf(fixt.walletOwner);
    expect(balanceOwnerBefore / 10n ** 6n).eq(100_000_000);

    await fixt.tokenUSDC.transfer(addressContract, 100 * 10 ** 6);

    const balanceContract = await fixt.tokenUSDC.balanceOf(addressContract);
    expect(balanceContract / 10n ** 6n).eq(100);

    const balanceOwner = await fixt.tokenUSDC.balanceOf(fixt.walletOwner);
    expect(balanceOwner / 10n ** 6n).eq(100_000_000 - 100);

    await fixt.contractTestEmergencyWithdraw.emergencyTokenWithdraw(fixt.tokenUSDC.getAddress());

    const balanceContractAfter = await fixt.tokenUSDC.balanceOf(addressContract);
    expect(balanceContractAfter).eq(0);

    const balanceOwnerAfter = await fixt.tokenUSDC.balanceOf(fixt.walletOwner);
    expect(balanceOwnerAfter / 10n ** 6n).eq(100_000_000);
  });

  it("deposit and withdraw Token nonowner", async () =>
  {
    const fixt = await fixture();

    const addressContract = fixt.contractTestEmergencyWithdraw.getAddress();

    const balanceOwnerBefore = await fixt.tokenUSDC.balanceOf(fixt.walletOwner);
    expect(balanceOwnerBefore / 10n ** 6n).eq(100_000_000);

    await fixt.tokenUSDC.transfer(addressContract, 100 * 10 ** 6);

    const balanceContract = await fixt.tokenUSDC.balanceOf(addressContract);
    expect(balanceContract / 10n ** 6n).eq(100);

    const balanceOwner = await fixt.tokenUSDC.balanceOf(fixt.walletOwner);
    expect(balanceOwner / 10n ** 6n).eq(100_000_000 - 100);

    await expect(fixt.contractTestEmergencyWithdraw.connect(fixt.wallet1).emergencyTokenWithdraw(fixt.tokenUSDC.getAddress()))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });
});
