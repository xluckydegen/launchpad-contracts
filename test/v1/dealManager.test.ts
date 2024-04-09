/*import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V1/DealManager", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);

    const factoryDealManager = await hre.ethers.getContractFactory("DealManager");
    const contractDealManager = await factoryDealManager.deploy();

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const token = await factoryToken.deploy("USDC", 6);

    return {
      contractDealManager,
      token,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  async function getDealStruct(dealCfg: {
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
    return {
      createdAt: 0,
      updatedAt: 0,
      interestDiscoveryActive: false,
      fundraisingActiveForRegistered: false,
      fundraisingActiveForEveryone: false,
      refundAllowed: false,
      minAllocation: 0,
      maxAllocation: 0,
      totalAllocation: 0,
      collectedToken: "0x000000000000000000000000000000000000dead",
      ...dealCfg
    };
  }

  it("empty deals", async () =>
  {
    const fixt = await fixture();

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(0);
  });

  it("register deal", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.deals("1234");
    expect(deal.uuid).eq("1234");
    expect(deal.createdAt).not.eq(0);

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(1);
  });

  it("register deal invalid - addr", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234", collectedToken: "0x0000000000000000000000000000000000000000" });
    await expect(fixt.contractDealManager.storeDeal(dealInitial))
      .revertedWithCustomError(fixt.contractDealManager, "DealManager_InvalidDealData")
      .withArgs("TOK");
  });

  it("register deal invalid - max", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234", maxAllocation: 10 });
    await expect(fixt.contractDealManager.storeDeal(dealInitial))
      .revertedWithCustomError(fixt.contractDealManager, "DealManager_InvalidDealData")
      .withArgs("MAX");
  });

  it("register deal invalid - min", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234", minAllocation : 15, maxAllocation: 10, totalAllocation: 20 });
    await expect(fixt.contractDealManager.storeDeal(dealInitial))
      .revertedWithCustomError(fixt.contractDealManager, "DealManager_InvalidDealData")
      .withArgs("MIN");
  });

  it("register deal invalid - uuid", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "" });
    await expect(fixt.contractDealManager.storeDeal(dealInitial))
      .revertedWithCustomError(fixt.contractDealManager, "DealManager_InvalidDealData")
      .withArgs("IU");
  });

  it("register deal nonOwner", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).storeDeal(dealInitial)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(0);
  });

  it("register deal admin", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).storeDeal(dealInitial)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    //grant admin role
    const roleEditor = ethers.keccak256(ethers.toUtf8Bytes("EDITOR"));
    await fixt.contractDealManager.grantRole(roleEditor, fixt.wallet1.address);

    await fixt.contractDealManager.connect(fixt.wallet1).storeDeal(dealInitial);

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(1);
  });

  it("update deal", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.deals("1234");
    expect(deal.uuid).eq("1234");
    expect(deal.createdAt).not.eq(0);
    expect(deal.maxAllocation).eq(0);

    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };
    await fixt.contractDealManager.storeDeal(dealUpdate);

    const deal2 = await fixt.contractDealManager.deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation).eq(100);
  });

  it("update deal nonOwner", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.deals("1234");
    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };

    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).storeDeal(dealUpdate)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    const deal2 = await fixt.contractDealManager.deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation).eq(0);
  });

  it("update deal admin", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.deals("1234");
    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };

    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).storeDeal(dealUpdate)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    //grant admin role
    const roleEditor = ethers.keccak256(ethers.toUtf8Bytes("EDITOR"));
    await fixt.contractDealManager.grantRole(roleEditor, fixt.wallet1.address);

    await fixt.contractDealManager.storeDeal(dealUpdate);

    const deal2 = await fixt.contractDealManager.deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation).eq(100);
  });

  it("existDealByUuid", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(1);

    const exists0 = await fixt.contractDealManager.existDealByUuid("0000");
    const exists1 = await fixt.contractDealManager.existDealByUuid("1234");
    expect(exists0).eq(false);
    expect(exists1).eq(true);
  });

  it("getDealByUuid", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.getDealByUuid("1234");
    expect(deal.uuid).eq("1234");

    const dealUnknown = await fixt.contractDealManager.getDealByUuid("0000");
    await expect(dealUnknown.createdAt).eq(0);
  });

  it("getDealById", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const dealInitial2 = await getDealStruct({ uuid: "2222" });
    await fixt.contractDealManager.storeDeal(dealInitial2);

    const deal1 = await fixt.contractDealManager.getDealById(0);
    expect(deal1.uuid).eq("1234");

    const deal2 = await fixt.contractDealManager.getDealById(1);
    expect(deal2.uuid).eq("2222");

    expect(deal1.createdAt).lt(deal2.createdAt);

    await expect(fixt.contractDealManager.getDealById(2))
      .revertedWithCustomError(fixt.contractDealManager, "DealManager_InvalidDealId");
  });

  it("countDeals", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.storeDeal(dealInitial);

    const dealInitial2 = await getDealStruct({ uuid: "2222" });
    await fixt.contractDealManager.storeDeal(dealInitial2);

    const count = await fixt.contractDealManager.countDeals();
    expect(count).eq(2);
  });

});
*/