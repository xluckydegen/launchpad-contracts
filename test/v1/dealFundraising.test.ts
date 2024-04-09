/*import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V1/DealFundraising", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);
    const wallet4 = new Wallet(EthersWallets.devWalletGanache06.private!, owner.provider);

    const factoryCommunityManager = await hre.ethers.getContractFactory("CommunityManager");
    const contractCommunityManager = await factoryCommunityManager.deploy();

    const uuidMainCommunity = "1111";
    await contractCommunityManager.registerCommunity(uuidMainCommunity);

    const factoryCommunityMemberNft = await hre.ethers.getContractFactory("CommunityMemberNft");
    const contractCommunityMemberNft = await factoryCommunityMemberNft.deploy(await contractCommunityManager.getAddress(), uuidMainCommunity);

    const factoryDealManager = await hre.ethers.getContractFactory("DealManager");
    const contractDealManager = await factoryDealManager.deploy();

    const factoryDealInterestDiscovery = await hre.ethers.getContractFactory("DealInterestDiscovery");
    const contractDealInterestDiscovery = await factoryDealInterestDiscovery.deploy(await contractDealManager.getAddress(), await contractCommunityMemberNft.getAddress());

    const factoryDealFundraising = await hre.ethers.getContractFactory("DealFundraising");
    const contractDealFundraising = await factoryDealFundraising.deploy(await contractDealManager.getAddress(), await contractCommunityMemberNft.getAddress(), await contractDealInterestDiscovery.getAddress());

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const tokenUSDC = await factoryToken.deploy("USDC", 6);

    const roleEditor = ethers.keccak256(ethers.toUtf8Bytes("EDITOR"));
    await contractCommunityManager.grantRole(roleEditor, walletAdmin.address);
    await contractDealManager.grantRole(roleEditor, walletAdmin.address);
    await contractDealFundraising.grantRole(roleEditor, walletAdmin.address);

    //fund wallets
    const decimals = BigInt(await tokenUSDC.decimals());
    await tokenUSDC.connect(walletOwner).mint(1000n * 10n ** decimals);
    await tokenUSDC.connect(walletAdmin).mint(1000n * 10n ** decimals);
    await tokenUSDC.connect(wallet1).mint(1000n * 10n ** decimals);
    await tokenUSDC.connect(wallet2).mint(1000n * 10n ** decimals);
    await tokenUSDC.connect(wallet3).mint(1000n * 10n ** decimals);
    await tokenUSDC.connect(wallet4).mint(1000n * 10n ** decimals);

    //mint nft community
    await contractCommunityMemberNft.mintCommunity(uuidMainCommunity);
    await contractCommunityMemberNft.connect(wallet1).mintCommunity(uuidMainCommunity);
    await contractCommunityMemberNft.connect(wallet2).mintCommunity(uuidMainCommunity);

    return {
      contractCommunityManager, contractCommunityMemberNft, contractDealManager,
      contractDealInterestDiscovery, contractDealFundraising,
      tokenUSDC,
      uuidMainCommunity,
      walletAdmin,
      walletMember1: wallet1,
      walletMember2: wallet2,
      walletNonMember1: wallet3,
      walletNonMember2: wallet4,
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  async function setupDeal(fixt: any, dealCfg: {
    uuid: string,
    createdAt?: number,
    updatedAt?: number,
    interestDiscoveryActive?: boolean,
    fundraisingActiveForRegistered?: boolean,
    fundraisingActiveForEveryone?: boolean,
    refundAllowed?: boolean,
    minAllocation?: bigint,
    maxAllocation?: bigint,
    totalAllocation?: bigint,
    collectedToken?: string
  })
  {
    //create deal
    await fixt.contractDealManager.storeDeal({
      createdAt: 0,
      updatedAt: 0,
      interestDiscoveryActive: false,
      fundraisingActiveForRegistered: false,
      fundraisingActiveForEveryone: false,
      refundAllowed: false,
      minAllocation: 0,
      maxAllocation: 0,
      totalAllocation: 0,
      collectedToken: await fixt.tokenUSDC.getAddress(),
      ...dealCfg
    });
  }

  function ta(amount: number): bigint
  {
    return BigInt(amount) * (10n ** 6n);
  }

  const maxBigInt = BigInt("99999999999999999999999999");

  it("send funds to deal valid", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.walletMember1).registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    const withdrawalsD1 = await fixt.contractDealFundraising.dealsWithdrawals("D1");
    expect(withdrawalsD1).eq(0);

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - balanceWalletUsdcBefore).eq(ta(-100));
    expect(balanceContractUsdcAfter - balanceContractUsdcBefore).eq(ta(100));
  });

  it("send twice funds to registered deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.walletMember1).registerInterest("D1", ta(100));

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    const withdrawalsD1 = await fixt.contractDealFundraising.dealsWithdrawals("D1");
    expect(withdrawalsD1).eq(0);

    //try to send again
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_OnlyPreregisteredAmountAllowed");

    const depositedD2 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD2).eq(ta(100));

    const depositedWOD2 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD2).eq(ta(100));

    const withdrawalsD2 = await fixt.contractDealFundraising.dealsWithdrawals("D1");
    expect(withdrawalsD2).eq(0);
  });

  it("two members send maximum funds to deal valid", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(400),
    });

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet2UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.tokenUSDC.connect(fixt.walletMember2).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(200));
    await fixt.contractDealFundraising.connect(fixt.walletMember2).purchase("D1", ta(200));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(400));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    const depositedWOD2 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember2.address);
    expect(depositedWOD1).eq(ta(200));
    expect(depositedWOD2).eq(ta(200));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet2UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter - (balanceWallet1UsdcBefore)).eq(ta(-200));
    expect(balanceWallet2UsdcAfter - (balanceWallet2UsdcBefore)).eq(ta(-200));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(400));

    // test dealsWalletsChangesCount
    const dealsWalletsChangesCount = await fixt.contractDealFundraising.dealsWalletsChangesCount("D1");
    expect(dealsWalletsChangesCount).eq(2);
  });

  it("send funds to not-existing deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D2", ta(100)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_UnknownDeal");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send funds to deal as non-member", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletNonMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletNonMember1).purchase("D1", ta(100)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_NotDaoMember");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send funds without enough funds", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.walletMember1).registerInterest("D1", ta(100));

    const balancePrepare = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceForTest = ta(90);
    await fixt.tokenUSDC.connect(fixt.walletMember1).transfer(fixt.walletNonMember1.address, balancePrepare - (balanceForTest));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    expect(balanceWalletUsdcBefore).eq(ta(90));

    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceContractUsdcBefore).eq(ta(0));

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_NotEnoughTokens");
  });

  it("send zero amount to deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(0)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_InvalidAmount");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send less than minimum per deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(10)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_MinimumNotMet");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send minimum and then less than minimum per deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(50));

    //and try to send less than minimum
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(10));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(ta(-60));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(60));
  });

  it("send more than maximum per deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(300)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_MaximumNotMet");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send to disabled fundraising", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: false,
      fundraisingActiveForEveryone: false,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(200)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_FundraisingNotAllowed");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send as non registered to registered-only round", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: false,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(200)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_OnlyPreregisteredAmountAllowed");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("send as non registered to public round", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("send more than maximum compounded per wallet allocation", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(300),
    });

    //buy 200
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(150));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_MaximumNotMet");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });


  it("send more than maximum compounded total allocation", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForRegistered: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(300),
    });

    //buy 200
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(200));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember2).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember2).purchase("D1", ta(200)))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_TotalAllocationReached");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("refunding allowed", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await fixt.contractDealFundraising.connect(fixt.walletMember1).refund("D1");

    const depositedD2 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD2).eq(ta(0));

    const depositedWOD2 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD2).eq(ta(0));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);
  });

  it("refunding not allowed", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).refund("D1"))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_RefundNotAllowed");

    const depositedD2 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD2).eq(ta(100));

    const depositedWOD2 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD2).eq(ta(100));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("refunding one from many allowed", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet2UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    await fixt.tokenUSDC.connect(fixt.walletMember2).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember2).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(200));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    const depositedWOD2 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember2.address);
    expect(depositedWOD1).eq(ta(100));
    expect(depositedWOD2).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet2UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter - (balanceWallet1UsdcBefore)).eq(ta(-100));
    expect(balanceWallet2UsdcAfter - (balanceWallet2UsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(200));

    await fixt.contractDealFundraising.connect(fixt.walletMember1).refund("D1");

    const depositedD1b = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    const depositedWOD2b = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember2.address);
    expect(depositedWOD1b).eq(ta(0));
    expect(depositedWOD2b).eq(ta(100));

    const balanceWallet1UsdcAfterB = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet2UsdcAfterB = await fixt.tokenUSDC.balanceOf(fixt.walletMember2.address);
    const balanceContractUsdcAfterB = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfterB - (balanceWallet1UsdcBefore)).eq(0);
    expect(balanceWallet2UsdcAfterB - (balanceWallet2UsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfterB - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("refunding for non-invested wallet", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember2).refund("D1"))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_NothingToRefund");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("refunding for non-existing deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).refund("D2"))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_UnknownDeal");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter - (balanceWalletUsdcBefore)).eq(ta(-100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("withdraw raised tokens", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet4UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await fixt.contractDealFundraising.withdrawFundraisedTokens("D1", fixt.walletNonMember2.address);

    const depositedD1b = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1b).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet4UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter - (balanceWallet1UsdcBefore)).eq(ta(-100));
    expect(balanceWallet4UsdcAfter - (balanceWallet4UsdcBefore)).eq(ta(100));
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(0);

    await expect(fixt.contractDealFundraising.withdrawFundraisedTokens("D1", fixt.walletNonMember2.address))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_NothingToWithdraw");
  });

  it("withdraw one deal of many", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });
    await setupDeal(fixt, {
      uuid: "D2",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWalletBefore = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D2", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    const depositedD2 = await fixt.contractDealFundraising.dealsDeposits("D2");
    expect(depositedD1).eq(ta(100));
    expect(depositedD2).eq(ta(100));

    const balanceContractUsdcAfter1 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet1 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter1 - (balanceContractUsdcBefore)).eq(ta(200));
    expect(balanceTargetWallet1 - (balanceTargetWalletBefore)).eq(0);

    await fixt.contractDealFundraising.withdrawFundraisedTokens("D1", fixt.walletNonMember2.address);

    const balanceContractUsdcAfter2 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet2 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter2 - (balanceContractUsdcBefore)).eq(ta(100));
    expect(balanceTargetWallet2 - (balanceTargetWalletBefore)).eq(ta(100));

    await fixt.contractDealFundraising.withdrawFundraisedTokens("D2", fixt.walletNonMember2.address);

    const balanceContractUsdcAfter3 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet3 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter3 - (balanceContractUsdcBefore)).eq(0);
    expect(balanceTargetWallet3 - (balanceTargetWalletBefore)).eq(ta(200));
  });

  it("withdraw multiple times", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });
    await setupDeal(fixt, {
      uuid: "D2",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWalletBefore = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D2", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    const depositedD2 = await fixt.contractDealFundraising.dealsDeposits("D2");
    expect(depositedD1).eq(ta(100));
    expect(depositedD2).eq(ta(100));

    const balanceContractUsdcAfter1 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet1 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter1 - (balanceContractUsdcBefore)).eq(ta(200));
    expect(balanceTargetWallet1 - (balanceTargetWalletBefore)).eq(0);

    await fixt.contractDealFundraising.withdrawFundraisedTokens("D1", fixt.walletNonMember2.address);

    const balanceContractUsdcAfter2 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet2 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter2 - (balanceContractUsdcBefore)).eq(ta(100));
    expect(balanceTargetWallet2 - (balanceTargetWalletBefore)).eq(ta(100));

    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D2", ta(100));

    const balanceContractUsdcAfter3 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet3 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter3 - (balanceContractUsdcBefore)).eq(ta(300));
    expect(balanceTargetWallet3 - (balanceTargetWalletBefore)).eq(ta(100));

    await fixt.contractDealFundraising.withdrawFundraisedTokens("D1", fixt.walletNonMember2.address);

    const balanceContractUsdcAfter4 = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet4 = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    expect(balanceContractUsdcAfter4 - (balanceContractUsdcBefore)).eq(ta(200));
    expect(balanceTargetWallet4 - (balanceTargetWalletBefore)).eq(ta(200));
  });

  it("withdraw non-owner", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet4UsdcBefore = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).withdrawFundraisedTokens("D1", fixt.walletNonMember2.address))
      .rejectedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");

    const depositedD1b = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1b).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletMember1.address);
    const balanceWallet4UsdcAfter = await fixt.tokenUSDC.balanceOf(fixt.walletNonMember2.address);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOf(await fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter - (balanceWallet1UsdcBefore)).eq(ta(-100));
    expect(balanceWallet4UsdcAfter - (balanceWallet4UsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter - (balanceContractUsdcBefore)).eq(ta(100));
  });

  it("withdraw to 0 address", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approve(await fixt.contractDealFundraising.getAddress(), maxBigInt);
    await fixt.contractDealFundraising.connect(fixt.walletMember1).purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 =
      await fixt.contractDealFundraising.dealsWalletsDeposits("D1", fixt.walletMember1.address);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.withdrawFundraisedTokens("D1", ethers.ZeroAddress))
      .revertedWithCustomError(fixt.contractDealFundraising, "DealFundraising_ZeroAddress");
  });

});
*/