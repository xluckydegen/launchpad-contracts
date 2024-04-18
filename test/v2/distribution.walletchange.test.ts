import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";

import { EthersWallets } from "../wallets.test";

describe("App/V2/Distribution/WalletChange", function ()
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
    const wallet5 = new Wallet(EthersWallets.devWalletGanache07.private!, owner.provider);

    const factoryDistributionWalletChange = await hre.ethers.getContractFactory("DistributionWalletChange");
    const contractDistributionWalletChange = await factoryDistributionWalletChange.deploy();

    const factoryDistribution = await hre.ethers.getContractFactory("Distribution");
    const contractDistribution = await factoryDistribution.deploy(contractDistributionWalletChange.getAddress());

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const tokenUSDC = await factoryToken.deploy("USDC", 6);

    return {
      contractDistributionWalletChange,
      contractDistribution,
      tokenUSDC,
      merkleTree: calulateDemoMerkleTree(),

      //token,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3, wallet4, wallet5
    };
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  async function getDistributionStruct(distributionCfg: {
    uuid?: string,
    createdAt?: number,
    updatedAt?: number,
    token?: string,
    tokensTotal?: number,
    tokensDistributable?: number,
    merkleRoot?: string,
    enabled?: boolean
  })
  {
    //create Distribution
    return {
      uuid: "uuid" + Math.random() % 999999,
      createdAt: 0,
      updatedAt: 0,
      token: "0x0",
      tokensTotal: 0,
      tokensDistributable: 0,
      merkleRoot: "",
      enabled: true,
      ...distributionCfg
    };
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
  function calulateDemoMerkleTree()
  {
    const values = [
      [EthersWallets.devWalletGanache03.public, "1000000"],
      [EthersWallets.devWalletGanache04.public, "2000000"],
      [EthersWallets.devWalletGanache05.public, "3000000"],
    ];
    const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
    return {
      root: tree.root,
      walletProof1: tree.getProof(0),
      walletProof2: tree.getProof(1),
      walletProof3: tree.getProof(2),
      walletAmount1: Number(values[0][1]),
      walletAmount2: Number(values[1][1]),
      walletAmount3: Number(values[2][1]),
    }
  }

  it("changed to 4, claimed from 4 ok", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet4.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);


    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balanceWallet1 = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1).eq(0);
    const balanceWallet4 = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4).eq(0);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);
    const alreadyClaimed4 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4).eq(0);

    await fixt.contractDistribution.connect(fixt.wallet4).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const balanceWallet1After = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1After).eq(0);
    const balanceWallet4After = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4After).eq(1_000_000);

    const alreadyClaimed1After = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1After).eq(1_000_000);
    const alreadyClaimed4After = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4After).eq(0);
  });

  it("changed to 4, claimed from 1 err", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet4.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);


    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balanceWallet1 = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1).eq(0);
    const balanceWallet4 = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4).eq(0);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);
    const alreadyClaimed4 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4).eq(0);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).revertedWithCustomError(fixt.contractDistributionWalletChange, "DistributionWalletChange_AddressAlreadyRedirected");
  });

  it("changed to 4, claimed from 5 err", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet4.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);


    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balanceWallet1 = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1).eq(0);
    const balanceWallet4 = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4).eq(0);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);
    const alreadyClaimed4 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4).eq(0);

    await expect(fixt.contractDistribution.connect(fixt.wallet5).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidMerkleProof");
  });

  it("changed to 4 and then removed, claimed from 1 ok", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const WalletChangeInitial = await getWalletChangeStruct({
      walletFrom: fixt.wallet1.address,
      walletTo: fixt.wallet4.address,
    });
    await fixt.contractDistributionWalletChange.storeWalletChange(WalletChangeInitial);
    await fixt.contractDistributionWalletChange.removeWalletChange(WalletChangeInitial.uuid);

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balanceWallet1 = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1).eq(0);
    const balanceWallet4 = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4).eq(0);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);
    const alreadyClaimed4 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4).eq(0);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const balanceWallet1After = await fixt.tokenUSDC.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1After).eq(1_000_000);
    const balanceWallet4After = await fixt.tokenUSDC.balanceOf(fixt.wallet4.address);
    expect(balanceWallet4After).eq(0);

    const alreadyClaimed1After = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1After).eq(1_000_000);
    const alreadyClaimed4After = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet4.address);
    expect(alreadyClaimed4After).eq(0);
  });
});
