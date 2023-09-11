import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { EthersNetworkAccessManager, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { EthersContract } from "../shared/ethers/contracts/classContract";
import { EthersWallets } from "../shared/ethers/tests/classEthersTestingWallets";
import { Erc20Token } from "../shared/ethers/token/classErc20Token";


describe("App/DealInterestDiscovery", function ()
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

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const etherscontractToken = await factoryToken.deploy("USDC");
    await etherscontractToken.deployed();
    const contractToken = EthersContract.fromContract(nam, etherscontractToken);
    const token = Erc20Token.fromContract(nam, etherscontractToken);

    //refresh nonces for our NAM
    await nam.refreshProviderNonces();

    const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));
    contractCommunityManager.direct().grantRole(roleEditor, walletAdmin.public);
    contractCommunityMemberNft.direct().grantRole(roleEditor, walletAdmin.public);
    contractDealManager.direct().grantRole(roleEditor, walletAdmin.public);
    contractDealInterestDiscovery.direct().grantRole(roleEditor, walletAdmin.public);

    //mint nft community
    await contractCommunityMemberNft.direct().mint(uuidMainCommunity);

    return {
      contractCommunityManager, contractCommunityMemberNft, contractDealManager, contractDealInterestDiscovery,
      contractToken, token,
      uuidMainCommunity,
      nam,
      walletOwner,walletAdmin,
      wallet1, wallet2, wallet3,
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
    minAllocation?: number,
    maxAllocation?: number,
    totalAllocation?: number,
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
      collectedToken: fixt.token.getAddress(),
      ...dealCfg
    });
  }

  it("register to deal valid", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt,{
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    const interestD1a = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interestD1a.toNumber()).eq(0);

    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 100);

    const interestD1 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interestD1.toNumber()).eq(100);

    const interestD1WO = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.walletOwner.public);
    expect(interestD1WO.toNumber()).eq(100);

    const interestD1WOb = await fixt.contractDealInterestDiscovery.staticRead().getRegisteredAmount("D1", fixt.walletOwner.public);
    expect(interestD1WOb.toNumber()).eq(100);

    const interestD1WOc = await fixt.contractDealInterestDiscovery.staticRead().getRegisteredAmount("D1", fixt.wallet1.public);
    expect(interestD1WOc.toNumber()).eq(0);
  });

  it("multiple registrations to valid deal", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 300,
      collectedToken: fixt.token.getAddress()
    });
   
    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).direct().mint(fixt.uuidMainCommunity);
    await fixt.contractCommunityMemberNft.connect(fixt.wallet2).direct().mint(fixt.uuidMainCommunity);

    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest1.toNumber()).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).direct().registerInterest("D1", 100);

    const interest2 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest2.toNumber()).eq(200);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).direct().registerInterest("D1", 100);

    const interest3 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest3.toNumber()).eq(300);
  });

  it("modify allocation", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 300,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest1.toNumber()).eq(100);

    const interestW1 = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.walletOwner.public);
    expect(interestW1.toNumber()).eq(100);
    
    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 50);

    const interest2 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest2.toNumber()).eq(50);

    const interestW2 = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.walletOwner.public);
    expect(interestW2.toNumber()).eq(50);

    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 200);

    const interest3 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest3.toNumber()).eq(200);

    const interestW3 = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.walletOwner.public);
    expect(interestW3.toNumber()).eq(200);
  });

  it("modify allocation with other existing interest", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 300,
      collectedToken: fixt.token.getAddress()
    });

    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).direct().mint(fixt.uuidMainCommunity);
    await fixt.contractCommunityMemberNft.connect(fixt.wallet2).direct().mint(fixt.uuidMainCommunity);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).direct().registerInterest("D1", 200);
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).direct().registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest1.toNumber()).eq(300);

    const interestW1 = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.wallet1.public);
    const interestW2 = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.wallet2.public);
    expect(interestW1.toNumber()).eq(200);
    expect(interestW2.toNumber()).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).direct().registerInterest("D1", 100);

    const interest2b = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest2b.toNumber()).eq(200);

    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).direct().registerInterest("D1", 200);

    const interest2c = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest2c.toNumber()).eq(300);

    const interestW1d = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.wallet1.public);
    const interestW2d = await fixt.contractDealInterestDiscovery.staticRead().dealsWalletsInterest("D1", fixt.wallet2.public);
    expect(interestW1d.toNumber()).eq(100);
    expect(interestW2d.toNumber()).eq(200);
  });

  it("attempt register to unknown deal", async () =>
  {
    const fixt = await fixture();

    //register interest
    await expect(fixt.contractDealInterestDiscovery.direct().registerInterest("Dx", 100)).revertedWith("Unknown deal");
  });

  it("attempt register to deal without NFT", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.connect(fixt.wallet1).direct().registerInterest("D1", 100)).revertedWith("Wallet is not DAO member");
  });

  it("attempt register with zero amount", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.direct().registerInterest("D1", -1)).rejected;
  });

  it("attempt register with not enough amount", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 10)).revertedWith("Minimum allocation not met");
  });

  it("attempt register with too mouch amount", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 300)).revertedWith("Maximum allocation not met");
  });

  it("attempt register with not active discovery phase", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: false,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 100)).revertedWith("Interest discovery not active");
  });

  it("attempt register with enough amount to not enough pool", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 300,
      collectedToken: fixt.token.getAddress()
    });

    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).direct().mint(fixt.uuidMainCommunity);
    
    //register interest
    await fixt.contractDealInterestDiscovery.direct().registerInterest("D1", 200);

    const interest1 = await fixt.contractDealInterestDiscovery.staticRead().dealsInterest("D1");
    expect(interest1.toNumber()).eq(200);

    //register interest
    await expect(fixt.contractDealInterestDiscovery.connect(fixt.wallet1).direct().registerInterest("D1", 200)).revertedWith("Total allocation reached");
  });

});
