import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { Wallet } from "ethers";
import hre from "hardhat";

import { EthersWallets } from "../wallets.test";

describe("App/V2/Distribution/Basics", function ()
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

  it("merkle tree fixture", async () =>
  {
    const merkle = calulateDemoMerkleTree();
    console.log(merkle.walletProof1);
  });

  it("empty Distributions", async () =>
  {
    const fixt = await fixture();

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(0);
  });

  it("register Distribution", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(1);
  });

  it("get Distribution", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(1);

    const uuid = await fixt.contractDistribution.distributionsIndexed(0);
    expect(uuid).eq(distributionInitial.uuid);

    const distributionFromContract = await fixt.contractDistribution.distributions(uuid);
    expect(distributionFromContract.uuid).eq(distributionInitial.uuid);
    expect(distributionFromContract.tokensTotal).eq(distributionInitial.tokensTotal);
    expect(distributionFromContract.merkleRoot).eq(distributionInitial.merkleRoot);
    expect(distributionFromContract.enabled).eq(distributionInitial.enabled);

    const lastChangedAt = await fixt.contractDistribution.distributionLastChangeAt(uuid);
    expect(lastChangedAt).eq(distributionFromContract.updatedAt);

    const lastAllChangedAt = await fixt.contractDistribution.lastChangeAt();
    expect(lastAllChangedAt).eq(lastChangedAt);
  });

  it("update Distribution", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 0,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const count = await fixt.contractDistribution.distributionsCount();
    expect(count).eq(1);

    const distributionFromContract = await fixt.contractDistribution.distributions(distributionInitial.uuid);
    expect(distributionFromContract.uuid).eq(distributionInitial.uuid);
    expect(distributionFromContract.tokensTotal).eq(distributionInitial.tokensTotal);
    expect(distributionFromContract.merkleRoot).eq(distributionInitial.merkleRoot);
    expect(distributionFromContract.enabled).eq(distributionInitial.enabled);

    distributionInitial.tokensTotal = 20_000_000;
    distributionInitial.tokensDistributable = 20_000_000;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    const distributionFromContract2 = await fixt.contractDistribution.distributions(distributionInitial.uuid);
    expect(distributionFromContract2.uuid).eq(distributionInitial.uuid);
    expect(distributionFromContract2.tokensTotal).eq(distributionInitial.tokensTotal);
    expect(distributionFromContract2.merkleRoot).eq(distributionInitial.merkleRoot);
    expect(distributionFromContract2.enabled).eq(distributionInitial.enabled);
  });

  it("deposit Distribution", async () =>
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

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 1_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 1_000_000);

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(1_000_000);

    const deposited = await fixt.contractDistribution.distributionDeposited(distributionInitial.uuid);
    expect(deposited).eq(1_000_000);
  });

  it("deposit Distribution multiple", async () =>
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

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 3_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 1_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 2_000_000);

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(3_000_000);

    const deposited = await fixt.contractDistribution.distributionDeposited(distributionInitial.uuid);
    expect(deposited).eq(3_000_000);
  });

  it("claim Distribution all", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(10_000_000);

    const deposited = await fixt.contractDistribution.distributionDeposited(distributionInitial.uuid);
    expect(deposited).eq(10_000_000);

    const balanceWallet = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWallet).eq(0);

    const alreadyClaimed = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed).eq(0);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const alreadyClaimedAfter = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimedAfter).eq(fixt.merkleTree.walletAmount1);

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1);

    const balanceAfter = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balanceAfter).eq(Number(balance) - fixt.merkleTree.walletAmount1);
  });

  it("claim Distribution partial", async () =>
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

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(5_000_000);

    const deposited = await fixt.contractDistribution.distributionDeposited(distributionInitial.uuid);
    expect(deposited).eq(5_000_000);

    const balanceWallet = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWallet).eq(0);

    const alreadyClaimed = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed).eq(0);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const alreadyClaimedAfter = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimedAfter).eq(fixt.merkleTree.walletAmount1 / 2);

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1 / 2);

    const balanceAfter = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balanceAfter).eq(Number(balance) - (fixt.merkleTree.walletAmount1 / 2));
  });

  it("claim Distribution two claims in row", async () =>
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

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
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
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1);
  });

  it("claim Distribution multi wallet", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(10_000_000);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);

    const alreadyClaimed2 = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet2.address);
    expect(alreadyClaimed2).eq(0);

    //claim wallet1
    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const alreadyClaimed1b = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1b).eq(fixt.merkleTree.walletAmount1);

    //claim wallet2
    await fixt.contractDistribution.connect(fixt.wallet2).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount2,
      fixt.merkleTree.walletProof2
    );

    const alreadyClaimed2b = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet2.address);
    expect(alreadyClaimed2b).eq(fixt.merkleTree.walletAmount2);

    const balanceAfter = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balanceAfter).eq(Number(balance) - fixt.merkleTree.walletAmount1 - fixt.merkleTree.walletAmount2);
  });

  it("claim Distribution changed amount", async () =>
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

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 1_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 1_000_000);

    //claim wallet1
    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1 / 2);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_NothingToClaim");

    distributionInitial.tokensDistributable = 1_000_000;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_NothingToClaim");

    distributionInitial.tokensDistributable = 10_000_000;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );
  });

  it("claim Distribution fractional", async () =>
  {
    const fraction = 1 / 4 / 365 / 24; //hourly claim;
    const totalTokens = 10_000_000;

    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: totalTokens,
      tokensDistributable: Math.floor(fraction * totalTokens),
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    const ratioClaim = distributionInitial.tokensDistributable / distributionInitial.tokensTotal;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), distributionInitial.tokensDistributable);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, distributionInitial.tokensDistributable);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    const expectedBalance = Math.floor(fixt.merkleTree.walletAmount1 * ratioClaim)
    expect(balanceWalletAfter).eq(expectedBalance);
  });

  it("claim Distribution continuous claiming", async () =>
  {
    const fraction = 1 / 4 / 12; //monthly claim;
    const totalTokens = 10_000_000;
    const distributableAmount = Math.floor(fraction * totalTokens);

    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: totalTokens,
      tokensDistributable: distributableAmount,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    const ratioClaim = distributionInitial.tokensDistributable / distributionInitial.tokensTotal;
    const ratioWalletToTotal = fixt.merkleTree.walletAmount1 / totalTokens;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    let distributedTokens = 0;
    while (distributedTokens != totalTokens)
    {
      const amountToDistribute = Math.min(distributableAmount, totalTokens - distributedTokens);
      distributedTokens += amountToDistribute;

      distributionInitial.tokensDistributable = distributedTokens;
      await fixt.contractDistribution.storeDistribution(distributionInitial);

      await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), amountToDistribute);
      await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, amountToDistribute);

      await fixt.contractDistribution.connect(fixt.wallet1).claim(
        distributionInitial.uuid,
        fixt.merkleTree.walletAmount1,
        fixt.merkleTree.walletProof1
      );

      const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
      const expectedBalance = Math.floor(ratioWalletToTotal * distributedTokens);
      expect(balanceWalletAfter).eq(expectedBalance);
    }

    const balanceWalletTotal = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletTotal).eq(fixt.merkleTree.walletAmount1);
  });

  it("claim Distribution claim disabled", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: false,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    const balance = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance).eq(10_000_000);

    const deposited = await fixt.contractDistribution.distributionDeposited(distributionInitial.uuid);
    expect(deposited).eq(10_000_000);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )).
      revertedWithCustomError(fixt.contractDistribution, "Distribution_Disabled");

    distributionInitial.enabled = true;
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    )

    const alreadyClaimedAfter = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimedAfter).eq(fixt.merkleTree.walletAmount1);

    const balanceWalletAfter = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWalletAfter).eq(fixt.merkleTree.walletAmount1);

    const balanceAfter = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balanceAfter).eq(Number(balance) - fixt.merkleTree.walletAmount1);
  });

  it("claim Distribution multi-claim", async () =>
  {
    const fixt = await fixture();

    const distributionInitial1 = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial1);

    const distributionInitial2 = await getDistributionStruct({
      token: await fixt.tokenUSDC2.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial2);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.tokenUSDC2.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial1.uuid, 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial2.uuid, 10_000_000);

    const balance1 = await fixt.tokenUSDC1.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance1).eq(10_000_000);
    const balance2 = await fixt.tokenUSDC2.balanceOf(await fixt.contractDistribution.getAddress());
    expect(balance2).eq(10_000_000);

    const balanceWallet1 = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1).eq(0);
    const balanceWallet2 = await fixt.tokenUSDC2.balanceOf(fixt.wallet1.address);
    expect(balanceWallet2).eq(0);

    const alreadyClaimed1 = await fixt.contractDistribution.walletClaims(distributionInitial1.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1).eq(0);
    const alreadyClaimed2 = await fixt.contractDistribution.walletClaims(distributionInitial2.uuid, fixt.wallet1.address);
    expect(alreadyClaimed2).eq(0);

    //claim wallet
    await fixt.contractDistribution.connect(fixt.wallet1).claimMultiple([{
      distributionUuid: distributionInitial1.uuid,
      maxAmount: fixt.merkleTree.walletAmount1,
      proof: fixt.merkleTree.walletProof1
    }, {
      distributionUuid: distributionInitial2.uuid,
      maxAmount: fixt.merkleTree.walletAmount1,
      proof: fixt.merkleTree.walletProof1
    }]
    );

    const alreadyClaimed1b = await fixt.contractDistribution.walletClaims(distributionInitial1.uuid, fixt.wallet1.address);
    expect(alreadyClaimed1b).eq(fixt.merkleTree.walletAmount1);
    const alreadyClaimed2b = await fixt.contractDistribution.walletClaims(distributionInitial2.uuid, fixt.wallet1.address);
    expect(alreadyClaimed2b).eq(fixt.merkleTree.walletAmount1);

    const balanceWallet1b = await fixt.tokenUSDC1.balanceOf(fixt.wallet1.address);
    expect(balanceWallet1b).eq(fixt.merkleTree.walletAmount1);
    const balanceWallet2b = await fixt.tokenUSDC2.balanceOf(fixt.wallet1.address);
    expect(balanceWallet2b).eq(fixt.merkleTree.walletAmount1);
  });

  it("pause Distribution", async () =>
  {
    const fixt = await fixture();
    const distributionInitial = await getDistributionStruct({
      token: await fixt.tokenUSDC1.getAddress(),
      tokensTotal: 10_000_000,
      tokensDistributable: 10_000_000,
      merkleRoot: fixt.merkleTree.root,
      enabled: true,
    });
    await fixt.contractDistribution.storeDistribution(distributionInitial);

    await fixt.tokenUSDC1.approve(await fixt.contractDistribution.getAddress(), 10_000_000);
    await fixt.contractDistribution.depositTokensToDistribution(distributionInitial.uuid, 10_000_000);

    await fixt.contractDistribution.emergencyDistributionsPause(true);

    await expect(fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    ))
      .revertedWithCustomError(fixt.contractDistribution, "Distribution_Disabled");

    await fixt.contractDistribution.emergencyDistributionsPause(false);

    await fixt.contractDistribution.connect(fixt.wallet1).claim(
      distributionInitial.uuid,
      fixt.merkleTree.walletAmount1,
      fixt.merkleTree.walletProof1
    );

    const alreadyClaimedAfter = await fixt.contractDistribution.walletClaims(distributionInitial.uuid, fixt.wallet1.address);
    expect(alreadyClaimedAfter).eq(fixt.merkleTree.walletAmount1);
  });

  it("change Distribution changeToken before deposit", async () =>
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
    distributionInitial.token = "0xdbe4a2044426fbfeb8939743fa0a679ba0d4b2f1";
    fixt.contractDistribution.storeDistribution(distributionInitial);

    const distrRead = await fixt.contractDistribution.distributions(distributionInitial.uuid);
    expect(distrRead.token).eq("0xdbe4a2044426fbfeb8939743fa0a679ba0d4b2f1");
  });

});
