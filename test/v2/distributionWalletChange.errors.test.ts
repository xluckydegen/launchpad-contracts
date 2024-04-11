import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V2/DistributionWalletChange/Errors", function ()
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
    const wallet4 = new Wallet(EthersWallets.devWalletGanache06.private!, owner.provider);

    const factoryDistributionWalletChange = await hre.ethers.getContractFactory("DistributionWalletChange");
    const contractDistributionWalletChange = await factoryDistributionWalletChange.deploy();

    return {
      contractDistributionWalletChange,
      //token,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3, wallet4
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

  it("register WalletChange invalid uuid", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      uuid: "",
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });
    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_InvalidData")
      .withArgs("IWU");
  });


  it("register WalletChange invalid from addr", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: "0x0000000000000000000000000000000000000000",
      walletTo: fixt.wallet2.address,
    });
    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_InvalidData")
      .withArgs("IWF");
  });

  it("register WalletChange invalid same addrs", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo:fixt.wallet1.address,
    });
    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_InvalidData")
      .withArgs("IWFT");
  });

  it("register WalletChange invalid to addr", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: "0x0000000000000000000000000000000000000000",
    });
    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_InvalidData")
      .withArgs("IWT");
  });

  it("register WalletChange existing uuid", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });

    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const WalletChangeInitial2 = await getWalletChangeStruct({
      uuid: WalletChangeInitial.uuid,
      walletFrom: fixt.wallet3.address,
      walletTo: fixt.wallet4.address,
    });

    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial2))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_DataAlreadyExists")
      .withArgs("UUID");
  });

  it("register WalletChange existing wallet from", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });

    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const WalletChangeInitial2 = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet4.address,
    });

    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial2))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_DataAlreadyExists")
      .withArgs("DWF");
  });

  it("register WalletChange existing wallet to", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });

    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    const WalletChangeInitial2 = await getWalletChangeStruct({
      walletFrom: fixt.wallet3.address,
      walletTo: fixt.wallet2.address,
    });

    await expect(fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial2))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_DataAlreadyExists")
      .withArgs("DWT");
  });

  it("remove WalletChange not existing", async () =>
  {
    const fixt = await fixture();

    await expect(fixt.contractDistributionWalletChange.removeWalletChange("1234"))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_DataNotExists");
  });

  it("remove WalletChange already removed", async () =>
  {
    const fixt = await fixture();
    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet2.address,
    });

    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);

    await fixt.contractDistributionWalletChange.removeWalletChange(WalletChangeInitial.uuid);

    await expect(fixt.contractDistributionWalletChange.removeWalletChange(WalletChangeInitial.uuid))
      .revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_DataNotExists");
  });
});
