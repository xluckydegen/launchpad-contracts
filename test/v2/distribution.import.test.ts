import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "../wallets.test";

describe("App/V2/Distribution/Imports", function ()
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

    const factoryDistribution = await hre.ethers.getContractFactory("Distribution");
    const contractDistribution = await factoryDistribution.deploy(contractDistributionWalletChange.getAddress());

    const factoryToken = await hre.ethers.getContractFactory("TestToken");
    const tokenUSDC = await factoryToken.deploy("USDC", 6);

    const factoryToken2 = await hre.ethers.getContractFactory("TestToken");
    const tokenUSDC2 = await factoryToken2.deploy("USDC", 6);

    return {
      contractDistributionWalletChange,
      contractDistribution,
      tokenUSDC1: tokenUSDC, tokenUSDC2,
      merkleTree: calulateDemoMerkleTree(),

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
    createdAt?: number,
    updatedAt?: number,
    walletFrom?: string,
    walletTo?: string,
    signature?: string,
    message?: string,
    enabled?: boolean,
  })
  {
    //create WalletChange
    return {
      createdAt: 0,
      updatedAt: 0,
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

  it("import Distribution and check", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 5_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);

    const alreadyClaimed = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed).eq(0);

    await fixt.contractDistribution.emergencyImportClaims(
      distributionInitial.uuid,
      [{ wallet: fixt.wallet1.address, claimedAmount: fixt.merkleTree.walletAmount1 / 2 }]
    );

    const alreadyClaimed2 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed2).eq(fixt.merkleTree.walletAmount1 / 2);
  });

  it("import Distribution and claim", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 5_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);

    const alreadyClaimed = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed).eq(0);

    await fixt.contractDistribution.emergencyImportClaims(
      distributionInitial.uuid,
      [{ wallet: fixt.wallet1.address, claimedAmount: fixt.merkleTree.walletAmount1 / 2 }]
    );

    const alreadyClaimed2 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed2).eq(fixt.merkleTree.walletAmount1 / 2);

    distributionInitial.tokensDistributable = 10_000_000;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const alreadyClaimedAfter = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimedAfter).eq(fixt.merkleTree.walletAmount1);

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1 / 2); //because first half was only imported
  });


  it("import Distribution non owner", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 5_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);

    const alreadyClaimed = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed).eq(0);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).emergencyImportClaims(
      distributionInitial.uuid,
      [{ wallet: fixt.wallet1.address, claimedAmount: fixt.merkleTree.walletAmount1 / 2 }]
    )).revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

});
