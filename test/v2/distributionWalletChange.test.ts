import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V2/DistributionWalletChange/Basics", function ()
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

  it("register WalletChange target", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);
  });

  it("get data", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const walletChanges = await fixt.contractDistributionWalletChange.walletChanges(WalletChangeInitial.uuid);
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

  it("get data nonexists", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const walletChanges = await fixt.contractDistributionWalletChange.walletChanges("1234");
    expect(walletChanges.uuid.length).eq(0);
    expect(walletChanges.createdAt).eq(0);
    expect(walletChanges.updatedAt).eq(0);
    expect(walletChanges.deletedAt).eq(0);
    expect(walletChanges.walletFrom).eq("0x0000000000000000000000000000000000000000");
    expect(walletChanges.walletTo).eq("0x0000000000000000000000000000000000000000");
    expect(walletChanges.signature).eq("");
    expect(walletChanges.message).eq("");
  });

  it("tranmslate WalletChange target", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);
  });

  it("tranmslate WalletChange source", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    await expect(fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet1.address))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_AddressAlreadyRedirected");
  });

  it("tranmslate WalletChange unknown", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet3.address);
    expect(targetWallet).eq(fixt.wallet3.address);
  });

  it("translateAddress deleted", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);
    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);

    await expect(fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet1.address))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_AddressAlreadyRedirected");

    await fixt.contractDistributionWalletChange.removeWalletChange(WalletChangeInitial.uuid);

    const targetWallet2 = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet2).eq(fixt.wallet2.address);

    const targetWallet3 = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet1.address);
    expect(targetWallet3).eq(fixt.wallet1.address);
  });

  it("delete WalletChange and add again", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);
    const targetWallet = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet).eq(fixt.wallet1.address);

    await fixt.contractDistributionWalletChange.removeWalletChange(WalletChangeInitial.uuid);

    const targetWallet2 = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet2).eq(fixt.wallet2.address);

    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const targetWallet3 = await fixt.contractDistributionWalletChange.translateAddressToSourceAddress(fixt.wallet2.address);
    expect(targetWallet3).eq(fixt.wallet1.address);
  });

});
