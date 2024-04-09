/*import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V1/DealInterestDiscovery", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);

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

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const token = await factoryToken.deploy("USDC", 6);

    const roleEditor = ethers.keccak256(ethers.toUtf8Bytes("EDITOR"));
    await contractCommunityManager.grantRole(roleEditor, walletAdmin.address);
    await contractDealManager.grantRole(roleEditor, walletAdmin.address);

    //mint nft community
    await contractCommunityMemberNft.mintCommunity(uuidMainCommunity);

    return {
      contractCommunityManager, contractCommunityMemberNft, contractDealManager, contractDealInterestDiscovery,
      token,
      uuidMainCommunity,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3,
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
    minAllocation?: number,
    maxAllocation?: number,
    totalAllocation?: number,
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
      collectedToken: await fixt.token.getAddress(),
      ...dealCfg
    });
  }

  it("register to deal valid", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: await fixt.token.getAddress()
    });

    const interestD1a = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interestD1a).eq(0);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 100);

    const interestD1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interestD1).eq(100);

    const interestD1WO = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestD1WO).eq(100);

    const interestD1WOb = await fixt.contractDealInterestDiscovery.getRegisteredAmount("D1", fixt.walletOwner.address);
    expect(interestD1WOb).eq(100);

    const interestD1WOc = await fixt.contractDealInterestDiscovery.getRegisteredAmount("D1", fixt.wallet1.address);
    expect(interestD1WOc).eq(0);
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
      collectedToken: await fixt.token.getAddress()
    });

    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).mintCommunity(fixt.uuidMainCommunity);
    await fixt.contractCommunityMemberNft.connect(fixt.wallet2).mintCommunity(fixt.uuidMainCommunity);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest1).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).registerInterest("D1", 100);

    const interest2 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest2).eq(200);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).registerInterest("D1", 100);

    const interest3 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest3).eq(300);
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest1).eq(100);

    const interestW1 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestW1).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 50);

    const interest2 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest2).eq(50);

    const interestW2 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestW2).eq(50);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 200);

    const interest3 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest3).eq(200);

    const interestW3 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestW3).eq(200);
  });

  it("storno allocation", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 300,
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest1).eq(100);

    const interestW1 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestW1).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 0);

    const interest2 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest2).eq(0);

    const interestW2 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.walletOwner.address);
    expect(interestW2).eq(0);
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
      collectedToken: await fixt.token.getAddress()
    });

    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).mintCommunity(fixt.uuidMainCommunity);
    await fixt.contractCommunityMemberNft.connect(fixt.wallet2).mintCommunity(fixt.uuidMainCommunity);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).registerInterest("D1", 200);
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).registerInterest("D1", 100);

    const interest1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest1).eq(300);

    const interestW1 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet1.address);
    const interestW2 = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet2.address);
    expect(interestW1).eq(200);
    expect(interestW2).eq(100);

    //register interest
    await fixt.contractDealInterestDiscovery.connect(fixt.wallet1).registerInterest("D1", 100);

    const interest2b = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest2b).eq(200);

    await fixt.contractDealInterestDiscovery.connect(fixt.wallet2).registerInterest("D1", 200);

    const interest2c = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest2c).eq(300);

    const interestW1d = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet1.address);
    const interestW2d = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet2.address);
    expect(interestW1d).eq(100);
    expect(interestW2d).eq(200);
  });

  it("attempt register to unknown deal", async () =>
  {
    const fixt = await fixture();

    //register interest
    await expect(fixt.contractDealInterestDiscovery.registerInterest("Dx", 100))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_UnknownDeal");
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.connect(fixt.wallet1).registerInterest("D1", 100))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_NotDaoMember");
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.registerInterest("D1", -1)).rejected;
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.registerInterest("D1", 10))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_MinimumNotMet");
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.registerInterest("D1", 300))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_MaximumNotMet");
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
      collectedToken: await fixt.token.getAddress()
    });

    //register interest
    await expect(fixt.contractDealInterestDiscovery.registerInterest("D1", 100))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_InterestDiscoveryNotActive");
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
      collectedToken: await fixt.token.getAddress()
    });

    //mint nft community
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).mintCommunity(fixt.uuidMainCommunity);

    //register interest
    await fixt.contractDealInterestDiscovery.registerInterest("D1", 200);

    const interest1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interest1).eq(200);

    //register interest
    await expect(fixt.contractDealInterestDiscovery.connect(fixt.wallet1).registerInterest("D1", 200))
      .revertedWithCustomError(fixt.contractDealInterestDiscovery, "DealInterestDiscovery_TotalAllocationReached");
  });

  it("mass import", async () =>
  {
    const fixt = await fixture();

    //create deal
    await setupDeal(fixt, {
      uuid: "D1",
      interestDiscoveryActive: true,
      minAllocation: 50,
      maxAllocation: 200,
      totalAllocation: 1000,
      collectedToken: await fixt.token.getAddress()
    });

    const interestD1a = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    await fixt.contractCommunityMemberNft.connect(fixt.wallet1).mintCommunity(fixt.uuidMainCommunity);
    await fixt.contractCommunityMemberNft.connect(fixt.wallet2).mintCommunity(fixt.uuidMainCommunity);

    expect(interestD1a).eq(0);

    //register interest
    await fixt.contractDealInterestDiscovery.importOldDealInterests(
      "D1",
      [fixt.wallet1.address, fixt.wallet2.address],
      [100, 100]
    );

    const interestD1 = await fixt.contractDealInterestDiscovery.dealsInterest("D1");
    expect(interestD1).eq(200);

    const interestD1WO = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet1.address);
    expect(interestD1WO).eq(100);

    const interestD2WO = await fixt.contractDealInterestDiscovery.dealsWalletsInterest("D1", fixt.wallet2.address);
    expect(interestD2WO).eq(100);
  });

});
*/