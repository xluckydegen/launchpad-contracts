import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet, ethers } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "./wallets.test";


describe("App/CommunityManager", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);

    const factoryCommunityManager = await hre.ethers.getContractFactory("CommunityManager");
    const ethersContractCommunityManager = await factoryCommunityManager.deploy();
    const contractCommunityManager = await ethersContractCommunityManager.deployed();

    return {
      contractCommunityManager,
      walletOwner, wallet1, walletAdmin
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  it("empty communities", async () =>
  {
    const fixt = await fixture();

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(0);
  });

  it("registerCommunity", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");

    const community = (await fixt.contractCommunityManager.communities("1234")) as any;
    expect(community.createdAt).not.eq(0);

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(1);
  });

  it("registerCommunity duplicate", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");
    await expect(fixt.contractCommunityManager.registerCommunity("1234")).rejectedWith("Community already exists");
  });

  it("registerCommunity nonOwner", async () =>
  {
    const fixt = await fixture();

    await expect(
      fixt.contractCommunityManager.connect(fixt.wallet1).registerCommunity("1234")
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(0);
  });

  it("registerCommunity admin", async () =>
  {
    const fixt = await fixture();

    await expect(
      fixt.contractCommunityManager.connect(fixt.wallet1).registerCommunity("1234")
    ).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x8c93699475be54d1d73bbbabee1213ba5867c90fcebb8234a4274f68c8da4977");

    //grant admin role
    const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));
    await fixt.contractCommunityManager.grantRole(roleEditor, fixt.wallet1.address);

    await fixt.contractCommunityManager.connect(fixt.wallet1).registerCommunity("1234");

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(1);
  });

  it("existCommunityByUuid", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");
    await fixt.contractCommunityManager.registerCommunity("2222");

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(2);

    const exists0 = await fixt.contractCommunityManager.existCommunityByUuid("0000");
    const exists1 = await fixt.contractCommunityManager.existCommunityByUuid("1234");
    const exists2 = await fixt.contractCommunityManager.existCommunityByUuid("2222");
    const exists3 = await fixt.contractCommunityManager.existCommunityByUuid("3333");
    expect(exists0).eq(false);
    expect(exists1).eq(true);
    expect(exists2).eq(true);
    expect(exists3).eq(false);
  });

  it("getCommunityByUuid", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");

    const community = await fixt.contractCommunityManager.getCommunityByUuid("1234");
    expect(community.createdAt).not.eq(0);

    const communityUnknown = await fixt.contractCommunityManager.getCommunityByUuid("0000");
    await expect(communityUnknown.createdAt).eq(0);
  });

  it("getCommunityById", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");
    await fixt.contractCommunityManager.registerCommunity("2222");

    const community1 = await fixt.contractCommunityManager.getCommunityById(0);
    expect(community1.createdAt).not.eq(0);

    const community2 = await fixt.contractCommunityManager.getCommunityById(1);
    expect(community2.createdAt).not.eq(0);

    expect(community1.createdAt).lt(community2.createdAt);

    await expect(fixt.contractCommunityManager.getCommunityById(2)).revertedWith("Out of bounds");
  });

  it("countCommunities", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityManager.registerCommunity("1234");
    await fixt.contractCommunityManager.registerCommunity("2222");

    const count = await fixt.contractCommunityManager.countCommunities();
    expect(count).eq(2);
  });
});
