import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V2/DistributionWalletChange/Permissions", function ()
{
  this.slow(100_000);

  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);

    const factoryDistributionWalletChange = await hre.ethers.getContractFactory("DistributionWalletChange");
    const contractDistributionWalletChange = await factoryDistributionWalletChange.deploy();

    return {
      contractDistributionWalletChange,
      //token,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  async function getWalletChangeStruct(WalletChangeCfg: {
    uuid?: string,
    createdAt?: number,
    updatedAt?: number,
    deletedAt?: number,
    walletFrom?: string,
    walletTo?: string,
    signature?: string,
    message?: string,
    enabled?: boolean,
  })
  {
    //create WalletChange
    return {
      uuid: "uuid" + Math.random() % 999999,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: 0,
      walletFrom: "0x0",
      walletTo: "0x0",
      signature: "",
      message: "",
      enabled: true,
      ...WalletChangeCfg
    };
  }

  it("transfer ownership", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });

    const roleAdmin = await fixt.contractDistributionWalletChange.DEFAULT_ADMIN_ROLE();
    await fixt.contractDistributionWalletChange.grantRole(roleAdmin, fixt.wallet1.address);
    await fixt.contractDistributionWalletChange.revokeRole(roleAdmin, fixt.walletOwner.address);

    await expect(fixt.contractDistributionWalletChange.connect(fixt.walletOwner).storeWalletChange(WalletChangeInitial))
      .revertedWith("AccessControl: account 0x6ba2fe81d6715b6de999a8b020016fe365f1e74d is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");

    await fixt.contractDistributionWalletChange.connect(fixt.wallet1).storeWalletChange(WalletChangeInitial);

    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);
  });

  it("register WalletChange nonowner", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await expect(fixt.contractDistributionWalletChange.connect(fixt.wallet1).storeWalletChange(WalletChangeInitial))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("get data nonowner", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const walletChanges = await fixt.contractDistributionWalletChange.connect(fixt.wallet1).walletChanges(WalletChangeInitial.uuid);
    expect(walletChanges.uuid.length).not.eq(0);
    expect(walletChanges.createdAt).not.eq(0);
    expect(walletChanges.updatedAt).not.eq(0);
    expect(walletChanges.updatedAt).eq(walletChanges.createdAt);
    expect(walletChanges.deletedAt).eq(0);
    expect(walletChanges.walletFrom).eq(fixt.wallet1.address);
    expect(walletChanges.walletTo).eq(fixt.wallet2.address);
    expect(walletChanges.signature).eq("");
    expect(walletChanges.message).eq("");
  });

  it("translate WalletChange target nonwoner", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const targetWallet = await fixt.contractDistributionWalletChange.connect(fixt.wallet1).translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);
  });

  it("delete WalletChange nonowner", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);
    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);

    await expect(fixt.contractDistributionWalletChange.connect(fixt.wallet1).removeWalletChange(WalletChangeInitial.uuid))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

});
