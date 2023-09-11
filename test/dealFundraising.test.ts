import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { EthersNetworkAccessManager, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { EthersContract } from "../shared/ethers/contracts/classContract";
import { EthersWallets } from "../shared/ethers/tests/classEthersTestingWallets";
import { Erc20Token } from "../shared/ethers/token/classErc20Token";
import { TokenAmount } from "../shared/blockchain/tokenAmount/tokenAmount";
import { BigNumber } from "ethers";


describe("App/DealFundraising", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const nam = EthersNetworkAccessManager.fromEthersProvider(EthersNetworks.arbitrum, hre.ethers.provider);
    const walletOwner = EthersWallet.fromSignerWithAddress(owner);
    const walletAdmin = EthersWallets.devWalletGanache02;
    const wallet1 = EthersWallets.devWalletGanache03;
    const wallet2 = EthersWallets.devWalletGanache04;
    const wallet3 = EthersWallets.devWalletGanache05;
    const wallet4 = EthersWallets.devWalletGanache06;

    const factoryCommunityManager = await hre.ethers.getContractFactory("CommunityManager");
    const ethersContractCommunityManager = await factoryCommunityManager.deploy();
    await ethersContractCommunityManager.deployed();
    const contractCommunityManager = EthersContract.fromContract(nam, ethersContractCommunityManager);

    const uuidMainCommunity = "1111";
    await contractCommunityManager.direct().registerCommunity(uuidMainCommunity);

    const factoryCommunityMemberNft = await hre.ethers.getContractFactory("CommunityMemberNft");
    const ethersContractCommunityMemberNft = await factoryCommunityMemberNft.deploy(contractCommunityManager.getAddress(), uuidMainCommunity);
    await ethersContractCommunityMemberNft.deployed();
    const contractCommunityMemberNft = EthersContract.fromContract(nam, ethersContractCommunityMemberNft);

    const factoryDealManager = await hre.ethers.getContractFactory("DealManager");
    const etherscontractDealManager = await factoryDealManager.deploy();
    await etherscontractDealManager.deployed();
    const contractDealManager = EthersContract.fromContract(nam, etherscontractDealManager);

    const factoryDealInterestDiscovery = await hre.ethers.getContractFactory("DealInterestDiscovery");
    const etherscontractDealInterestDiscovery = await factoryDealInterestDiscovery.deploy(contractDealManager.getAddress(), contractCommunityMemberNft.getAddress());
    await etherscontractDealInterestDiscovery.deployed();
    const contractDealInterestDiscovery = EthersContract.fromContract(nam, etherscontractDealInterestDiscovery);

    const factoryDealFundraising = await hre.ethers.getContractFactory("DealFundraising");
    const etherscontractDealFundraising = await factoryDealFundraising.deploy(contractDealManager.getAddress(), contractCommunityMemberNft.getAddress(), contractDealInterestDiscovery.getAddress());
    await etherscontractDealFundraising.deployed();
    const contractDealFundraising = EthersContract.fromContract(nam, etherscontractDealFundraising);

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const etherscontractToken = await factoryToken.deploy("USDC");
    await etherscontractToken.deployed();
    const contractTokenUSDC = EthersContract.fromContract(nam, etherscontractToken);
    const tokenUSDC = Erc20Token.fromContract(nam, etherscontractToken);

    //refresh nonces for our NAM
    await nam.refreshProviderNonces();

    const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));
    await contractCommunityManager.direct().grantRole(roleEditor, walletAdmin.public);
    await contractDealManager.direct().grantRole(roleEditor, walletAdmin.public);
    await contractDealFundraising.direct().grantRole(roleEditor, walletAdmin.public);

    //fund wallets
    await contractTokenUSDC.connect(walletOwner).direct().mint(1000n * 10n ** 18n);
    await contractTokenUSDC.connect(walletAdmin).direct().mint(1000n * 10n ** 18n);
    await contractTokenUSDC.connect(wallet1).direct().mint(1000n * 10n ** 18n);
    await contractTokenUSDC.connect(wallet2).direct().mint(1000n * 10n ** 18n);
    await contractTokenUSDC.connect(wallet3).direct().mint(1000n * 10n ** 18n);
    await contractTokenUSDC.connect(wallet4).direct().mint(1000n * 10n ** 18n);

    //mint nft community
    await contractCommunityMemberNft.direct().mint(uuidMainCommunity);
    await contractCommunityMemberNft.connect(wallet1).direct().mint(uuidMainCommunity);
    await contractCommunityMemberNft.connect(wallet2).direct().mint(uuidMainCommunity);

    return {
      contractCommunityManager, contractCommunityMemberNft, contractDealManager,
      contractDealInterestDiscovery, contractDealFundraising,
      contractTokenUSDC, tokenUSDC,
      uuidMainCommunity,
      nam,
      /*walletOwner,*/ walletAdmin,
      walletMember1: wallet1,
      walletMember2: wallet2,
      walletNonMember1: wallet3,
      walletNonMember2: wallet4,
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    await fixt.nam.refreshProviderNonces();
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
    minAllocation?: BigNumber,
    maxAllocation?: BigNumber,
    totalAllocation?: BigNumber,
    collectedToken?: string
  })
  {
    //create deal
    await fixt.contractDealManager.direct().storeDeal({
      createdAt: 0,
      updatedAt: 0,
      interestDiscoveryActive: false,
      fundraisingActiveForRegistered: false,
      fundraisingActiveForEveryone: false,
      refundAllowed: false,
      minAllocation: 0,
      maxAllocation: 0,
      totalAllocation: 0,
      collectedToken: fixt.tokenUSDC.getAddress(),
      ...dealCfg
    });
  }

  function ta(amount: number): BigNumber
  {
    return TokenAmount.from(amount).toBigNumber(18);
  }

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
    await fixt.contractDealInterestDiscovery.connect(fixt.walletMember1).direct().registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    const withdrawalsD1 = await fixt.contractDealFundraising.staticRead().dealsWithdrawals("D1");
    expect(withdrawalsD1).eq(0);

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(100);
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

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet2UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.tokenUSDC.connect(fixt.walletMember2).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(200));
    await fixt.contractDealFundraising.connect(fixt.walletMember2).direct().purchase("D1", ta(200));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(400));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    const depositedWOD2 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember2.public);
    expect(depositedWOD1).eq(ta(200));
    expect(depositedWOD2).eq(ta(200));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet2UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter.sub(balanceWallet1UsdcBefore)).eq(-200);
    expect(balanceWallet2UsdcAfter.sub(balanceWallet2UsdcBefore)).eq(-200);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(400);
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
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D2", ta(100))).revertedWith("Unknown deal");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletNonMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletNonMember1).direct().purchase("D1", ta(100))).revertedWith("Wallet is not DAO member");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", ta(100));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(0))).revertedWith("Amount has to be possitive");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(10))).revertedWith("Minimum allocation not met");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(50));

    //and try to send less than minimum
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(10));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(-60);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(60);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(300))).revertedWith("Maximum allocation not met");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(200))).revertedWith("Fundraising is not active");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(200))).revertedWith("Only pre-registered exact amount allowed");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(100);
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
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(150));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100))).revertedWith("Compounded maximum allocation not met");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(200));

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember2).approveSpender(fixt.contractDealFundraising.getAddress());
    await expect(fixt.contractDealFundraising.connect(fixt.walletMember2).direct().purchase("D1", ta(200))).revertedWith("Total allocation reached");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
  });

  it("refunding allowed", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed:true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));
    
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().refund("D1");

    const depositedD2 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD2).eq(ta(0));

    const depositedWOD2 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD2).eq(ta(0));

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
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

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet2UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    await fixt.tokenUSDC.connect(fixt.walletMember2).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember2).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(200));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    const depositedWOD2 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember2.public);
    expect(depositedWOD1).eq(ta(100));
    expect(depositedWOD2).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet2UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter.sub(balanceWallet1UsdcBefore)).eq(-100);
    expect(balanceWallet2UsdcAfter.sub(balanceWallet2UsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(200);

    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().refund("D1");

    const depositedD1b = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    const depositedWOD2b = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember2.public);
    expect(depositedWOD1b).eq(ta(0));
    expect(depositedWOD2b).eq(ta(100));

    const balanceWallet1UsdcAfterB = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet2UsdcAfterB = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember2.public);
    const balanceContractUsdcAfterB = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfterB.sub(balanceWallet1UsdcBefore)).eq(0);
    expect(balanceWallet2UsdcAfterB.sub(balanceWallet2UsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfterB.sub(balanceContractUsdcBefore)).eq(100);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember2).direct().refund("D1")).revertedWith("Nothing to refund");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(100);
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

    const balanceWalletUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().refund("D2")).revertedWith("Unknown deal");

    const balanceWalletUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWalletUsdcAfter.sub(balanceWalletUsdcBefore)).eq(-100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(100);
  });

  it("withdraw raised tokens", async () =>
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

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet4UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    await fixt.contractDealFundraising.direct().withdrawFundraisedTokens("D1", fixt.walletNonMember2.public);

    const depositedD1b = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1b).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet4UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter.sub(balanceWallet1UsdcBefore)).eq(-100);
    expect(balanceWallet4UsdcAfter.sub(balanceWallet4UsdcBefore)).eq(100);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(0);
  });

  it("withdraw one deal of many", async () =>
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
    await setupDeal(fixt, {
      uuid: "D2",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWalletBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D2", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    const depositedD2 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D2");
    expect(depositedD1).eq(ta(100));
    expect(depositedD2).eq(ta(100));

    const balanceContractUsdcAfter1 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet1 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter1.sub(balanceContractUsdcBefore)).eq(200);
    expect(balanceTargetWallet1.sub(balanceTargetWalletBefore)).eq(0);

    await fixt.contractDealFundraising.direct().withdrawFundraisedTokens("D1", fixt.walletNonMember2.public);

    const balanceContractUsdcAfter2 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet2 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter2.sub(balanceContractUsdcBefore)).eq(100);
    expect(balanceTargetWallet2.sub(balanceTargetWalletBefore)).eq(100);

    await fixt.contractDealFundraising.direct().withdrawFundraisedTokens("D2", fixt.walletNonMember2.public);

    const balanceContractUsdcAfter3 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet3 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter3.sub(balanceContractUsdcBefore)).eq(0);
    expect(balanceTargetWallet3.sub(balanceTargetWalletBefore)).eq(200);
  });

  it("withdraw multiple times", async () =>
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
    await setupDeal(fixt, {
      uuid: "D2",
      interestDiscoveryActive: true,
      fundraisingActiveForEveryone: true,
      refundAllowed: true,
      minAllocation: ta(50),
      maxAllocation: ta(200),
      totalAllocation: ta(1000),
    });

    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWalletBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D2", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    const depositedD2 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D2");
    expect(depositedD1).eq(ta(100));
    expect(depositedD2).eq(ta(100));

    const balanceContractUsdcAfter1 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet1 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter1.sub(balanceContractUsdcBefore)).eq(200);
    expect(balanceTargetWallet1.sub(balanceTargetWalletBefore)).eq(0);

    await fixt.contractDealFundraising.direct().withdrawFundraisedTokens("D1", fixt.walletNonMember2.public);

    const balanceContractUsdcAfter2 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet2 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter2.sub(balanceContractUsdcBefore)).eq(100);
    expect(balanceTargetWallet2.sub(balanceTargetWalletBefore)).eq(100);

    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D2", ta(100));

    const balanceContractUsdcAfter3 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet3 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter3.sub(balanceContractUsdcBefore)).eq(300);
    expect(balanceTargetWallet3.sub(balanceTargetWalletBefore)).eq(100);

    await fixt.contractDealFundraising.direct().withdrawFundraisedTokens("D1", fixt.walletNonMember2.public);

    const balanceContractUsdcAfter4 = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    const balanceTargetWallet4 = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    expect(balanceContractUsdcAfter4.sub(balanceContractUsdcBefore)).eq(200);
    expect(balanceTargetWallet4.sub(balanceTargetWalletBefore)).eq(200);
  });

  it("withdraw non-owner", async () =>
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

    const balanceWallet1UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet4UsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    const balanceContractUsdcBefore = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());

    //send money to deal
    await fixt.tokenUSDC.connect(fixt.walletMember1).approveSpender(fixt.contractDealFundraising.getAddress());
    await fixt.contractDealFundraising.connect(fixt.walletMember1).direct().purchase("D1", ta(100));

    const depositedD1 = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1).eq(ta(100));

    const depositedWOD1 = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1).eq(ta(100));

    await expect(fixt.contractDealFundraising.connect(fixt.walletMember1).direct().withdrawFundraisedTokens("D1", fixt.walletNonMember2.public)).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");

    const depositedD1b = await fixt.contractDealFundraising.staticRead().dealsDeposits("D1");
    expect(depositedD1b).eq(ta(100));

    const depositedWOD1b = await fixt.contractDealFundraising.staticRead().dealsWalletsDeposits("D1", fixt.walletMember1.public);
    expect(depositedWOD1b).eq(ta(100));

    const balanceWallet1UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletMember1.public);
    const balanceWallet4UsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.walletNonMember2.public);
    const balanceContractUsdcAfter = await fixt.tokenUSDC.balanceOfAddress(fixt.contractDealFundraising.getAddress());
    expect(balanceWallet1UsdcAfter.sub(balanceWallet1UsdcBefore)).eq(-100);
    expect(balanceWallet4UsdcAfter.sub(balanceWallet4UsdcBefore)).eq(0);
    expect(balanceContractUsdcAfter.sub(balanceContractUsdcBefore)).eq(100);
  });

});
