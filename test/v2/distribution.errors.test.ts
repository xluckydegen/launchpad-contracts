import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";
import { EthersWallets } from "../wallets.test";

describe("App/V2/Distribution/Errors", function ()
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

  it("register Distribution err_DU", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      uuid: "",
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await expect(fixt.contractDistribution.storeDistribution(distributionInitial)).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("DU");

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(0);
  });

  it("register Distribution err_DT", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: "0x0000000000000000000000000000000000000000",
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await expect(fixt.contractDistribution.storeDistribution(distributionInitial)).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("DT");

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(0);
  });

  // incorrect data length (argument="merkleRoot", value=[], code=INVALID_ARGUMENT, version=abi/5.7.0)
  // it("register Distribution err_DM", async () =>
  // {
  //   const fixt = await fixture();
  //   const distributionInitial = await getDistributionStruct({
  //     token: await fixt.tokenUSDC.getAddress(),
  //     tokensTotal: 10_000_000,
  //     tokensDistributable: 0,
  //     merkleRoot: [],
  //     enabled: true,
  //   });
  //   await expect(fixt.contractDistribution.storeDistribution(distributionInitial)).
  //     revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
  //     .withArgs("DM");

  //   const count = await fixt.contractDistribution.distributionsCount();
  //   expect(count).eq(0);
  // });

  it("register Distribution err_DTC", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 0,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await expect(fixt.contractDistribution.storeDistribution(distributionInitial)).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("DTC");

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(0);
  });

  it("register Distribution err_TT_TD", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC.getAddress(),
      tokensTotal: 100_000_000,
      tokensDistributable: 200_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await expect(fixt.contractDistribution.storeDistribution(distributionInitial)).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("TT_TD");

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(0);
  });

  it("deposit Distribution to nonexisting", async () =>
  {
    const fixt = await fixture();
    await expect(fixt.contractDistribution.depositTokensToDistribution("12345", 1_000_000)).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_DataNotExists");
  });

  it("deposit Distribution moreThanDistributable TB_TD", async () =>
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

    await expect(fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 6_000_000))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidParams")
      .withArgs("TB_TD");
  });

  it("deposit Distribution notEnoughTokens", async () =>
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

    const balance = await fixt.tokenUSDC.balanceOf(fixt.walletOwner.address);
    await fixt.tokenUSDC.transfer(fixt.wallet1.address, balance);

    await expect(fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 2_000_000))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_NotEnoughTokens");
  });

  it("change Distribution lessThanDeposited TD_AD", async () =>
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

    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);

    distributionInitial.tokensDistributable = 4_000_000;

    await expect(fixt.contractDistribution.storeDistribution(distributionInitial))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("TD_AD");
  });

  it("change Distribution changeToken after deposit RTC", async () =>
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
    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);

    distributionInitial.token = "0xdbe4a2044426fbfeb8939743fa0a679ba0d4b2f1";

    await expect(fixt.contractDistribution.storeDistribution(distributionInitial))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("RTC");
  });

  it("change Distribution changeMerkle after claim RMC", async () =>
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
    await fixt.tokenUSDC.approve(await fixt.contractDistribution.getAddress(), 5_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 5_000_000);
    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    distributionInitial.merkleRoot = fixt.merkleTree.root.slice(0, -4) + "cccc";

    await expect(fixt.contractDistribution.storeDistribution(distributionInitial))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidData")
      .withArgs("RMC");
  });

  it("claim Distribution not enough tokens", async () =>
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
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 1_000_000);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    await expect(fixt.contractDistribution.connect(fixt.wallet2).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount2,
      fixt.merkleTree.walletProof2
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_NotEnoughTokens");
  });

  it("claim Distribution invalid proof", async () =>
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

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof2
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_InvalidMerkleProof");
  });
});
