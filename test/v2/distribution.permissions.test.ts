import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre, { ethers } from "hardhat";

import { EthersWallets } from "../wallets.test";

describe("App/V2/Distribution/Permissions", function ()
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

    return {
      contractDistributionWalletChange,
      contractDistribution,
      tokenUSDC,
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

  it("register Distribution nonowner", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await expect(fixt.contractDistribution.connect(fixt.wallet1).storeDistribution(distributionInitial))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("deposit Distribution nondepositor", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 5_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 1_000_000);
    await expect(fixt.contractDistribution.connect(fixt.wallet1).depositTokensToDistribution(distributionInitial.uuid, 1_000_000))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x85faced7bde13e1a7dad704b895f006e704f207617d68166b31ba2d79624862d");
  });

  it("claim Distribution fake proof", async () =>
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

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    await expect(fixt.contractDistribution.connect(fixt.wallet4).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidMerkleProof");
  });

  it("give admin role", async () =>
  {
    const roleAdmin = ethers.encodeBytes32String("");
    const fixt = await fixture();

    await fixt.contractDistribution.grantRole(roleAdmin, fixt.wallet1.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.connect(fixt.wallet1).storeDistribution(distributionInitial);
    const distributionFromContract = await fixt.contractDistribution.distributions(distributionInitial.uuid);
    expect(distributionFromContract.uuid).eq(distributionInitial.uuid);
  });

  it("revoke admin role", async () =>
  {
    const roleAdmin = ethers.encodeBytes32String("");
    const fixt = await fixture();

    await fixt.contractDistribution.revokeRole(roleAdmin, fixt.walletOwner.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });

    await expect(fixt.contractDistribution.storeDistribution(distributionInitial))
      .revertedWith("AccessControl: account 0x6ba2fe81d6715b6de999a8b020016fe365f1e74d is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("reassign admin role", async () =>
  {
    const roleAdmin = ethers.encodeBytes32String("");
    const fixt = await fixture();

    await fixt.contractDistribution.grantRole(roleAdmin, fixt.wallet1.address);
    await fixt.contractDistribution.revokeRole(roleAdmin, fixt.walletOwner.address);
    await fixt.contractDistribution.connect(fixt.wallet1).grantRole(roleAdmin, fixt.walletOwner.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });

    await fixt.contractDistribution.storeDistribution(distributionInitial);
    const distributionFromContract = await fixt.contractDistribution.distributions(distributionInitial.uuid);
    expect(distributionFromContract.uuid).eq(distributionInitial.uuid);
  });

  it("assign distributor role", async () =>
  {
    const roleDistributor = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR"));
    const fixt = await fixture();

    await fixt.contractDistribution.grantRole(roleDistributor, fixt.wallet1.address);
    await fixt.contractDistribution.revokeRole(roleDistributor, fixt.walletOwner.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });

    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC.transfer(fixt.wallet1.address, 10_000_000);
    await fixt.tokenUSDC.connect(fixt.wallet1).approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.connect(fixt.wallet1).depositTokensToDistribution(distributionInitial.uuid, 10_000_000);
  });

  it("remove distributor role", async () =>
  {
    const roleDistributor = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR"));
    const fixt = await fixture();

    await fixt.contractDistribution.revokeRole(roleDistributor, fixt.walletOwner.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });

    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await expect(fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000))
      .revertedWith("AccessControl: account 0x6ba2fe81d6715b6de999a8b020016fe365f1e74d is missing role 0x85faced7bde13e1a7dad704b895f006e704f207617d68166b31ba2d79624862d");
  });

  it("reassign distributor role", async () =>
  {
    const roleDistributor = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR"));
    const fixt = await fixture();

    await fixt.contractDistribution.revokeRole(roleDistributor, fixt.walletOwner.address);
    await fixt.contractDistribution.grantRole(roleDistributor, fixt.walletOwner.address);

    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });

    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);
  });

  it("pause Distribution nonowner", async () =>
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

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).emergencyDistributionsPause(true))
      .revertedWith("AccessControl: account 0x22443427b6d090f53f18559c48d84f917e5908a9 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });
});
