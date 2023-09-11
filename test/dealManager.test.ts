import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { EthersNetworkAccessManager, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { EthersContract } from "../shared/ethers/contracts/classContract";
import { EthersWallets } from "../shared/ethers/tests/classEthersTestingWallets";
import { Erc20Token } from "../shared/ethers/token/classErc20Token";
import { EthersContractsTokens } from "../shared/ethers/contracts/classContractsTokens";


describe("App/DealManager", function ()
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

    const factoryDealManager = await hre.ethers.getContractFactory("DealManager");
    const etherscontractDealManager = await factoryDealManager.deploy();
    await etherscontractDealManager.deployed();
    const contractDealManager = EthersContract.fromContract(nam, etherscontractDealManager);

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const etherscontractToken = await factoryToken.deploy("USDC");
    await etherscontractToken.deployed();
    const contractToken = EthersContract.fromContract(nam, etherscontractToken);
    const token = Erc20Token.fromContract(nam, etherscontractToken);

    return {
      contractDealManager,
      contractToken, token,
      nam,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    await fixt.nam.refreshProviderNonces();
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
      collectedToken: EthersContractsTokens.addressNull,
      ...dealCfg
    };
  }

  it("empty deals", async () =>
  {
    const fixt = await fixture();

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(0);
  });

  it("register deal", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({uuid: "1234"});
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.staticRead().deals("1234");
    expect(deal.uuid).eq("1234");
    expect(deal.createdAt).not.eq(0);

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(1);
  });

  it("register deal nonOwner", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).direct().storeDeal(dealInitial)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(0);
  });

  it("register deal admin", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).direct().storeDeal(dealInitial)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    //grant admin role
    const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));
    await fixt.contractDealManager.direct().grantRole(roleEditor, fixt.wallet1.public);

    await fixt.contractDealManager.connect(fixt.wallet1).direct().storeDeal(dealInitial);

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(1);
  });

  it("update deal", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.staticRead().deals("1234");
    expect(deal.uuid).eq("1234");
    expect(deal.createdAt).not.eq(0);
    expect(deal.maxAllocation).eq(0);

    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };
    await fixt.contractDealManager.direct().storeDeal(dealUpdate);

    const deal2 = await fixt.contractDealManager.staticRead().deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation.toNumber()).eq(100);
  });

  it("update deal nonOwner", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.staticRead().deals("1234");
    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };

    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).direct().storeDeal(dealUpdate)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    const deal2 = await fixt.contractDealManager.staticRead().deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation).eq(0);
  });

  it("update deal admin", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.staticRead().deals("1234");
    const dealUpdate = {
      ...deal,
      totalAllocation: 100,
    };

    await expect(
      fixt.contractDealManager.connect(fixt.wallet1).direct().storeDeal(dealUpdate)
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    //grant admin role
    const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));
    await fixt.contractDealManager.direct().grantRole(roleEditor, fixt.wallet1.public);

    await fixt.contractDealManager.direct().storeDeal(dealUpdate);

    const deal2 = await fixt.contractDealManager.staticRead().deals("1234");
    expect(deal2.uuid).eq("1234");
    expect(deal2.createdAt).not.eq(0);
    expect(deal2.totalAllocation.toNumber()).eq(100);
  });

  it("existDealByUuid", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(1);

    const exists0 = await fixt.contractDealManager.staticRead().existDealByUuid("0000");
    const exists1 = await fixt.contractDealManager.staticRead().existDealByUuid("1234");
    expect(exists0).eq(false);
    expect(exists1).eq(true);
  });

  it("getDealByUuid", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const deal = await fixt.contractDealManager.staticRead().getDealByUuid("1234");
    expect(deal.uuid).eq("1234");

    const dealUnknown = await fixt.contractDealManager.staticRead().getDealByUuid("0000");
    await expect(dealUnknown.createdAt).eq(0);
  });

  it("getDealById", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const dealInitial2 = await getDealStruct({ uuid: "2222" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial2);

    const deal1 = await fixt.contractDealManager.staticRead().getDealById(0);
    expect(deal1.uuid).eq("1234");

    const deal2 = await fixt.contractDealManager.staticRead().getDealById(1);
    expect(deal2.uuid).eq("2222");

    expect(deal1.createdAt).lt(deal2.createdAt);

    await expect(fixt.contractDealManager.staticRead().getDealById(2)).revertedWith("Out of bounds");
  });

  it("countDeals", async () =>
  {
    const fixt = await fixture();
    const dealInitial = await getDealStruct({ uuid: "1234" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial);

    const dealInitial2 = await getDealStruct({ uuid: "2222" });
    await fixt.contractDealManager.direct().storeDeal(dealInitial2);

    const count = await fixt.contractDealManager.staticRead().countDeals();
    expect(count).eq(2);
  });

});
