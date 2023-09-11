import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { EthersNetworkAccessManager, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { EthersContract } from "../shared/ethers/contracts/classContract";
import { EthersWallets } from "../shared/ethers/tests/classEthersTestingWallets";


describe("App/CommunityMemberNft", function ()
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

    const factoryCommunity = await hre.ethers.getContractFactory("CommunityManager");
    const ethersContractCommunity = await factoryCommunity.deploy();
    await ethersContractCommunity.deployed();
    const contractCommunity = EthersContract.fromContract(nam, ethersContractCommunity);

    const uuidMainCommunity = "1111";
    await contractCommunity.direct().registerCommunity(uuidMainCommunity);

    const factoryCommunityMemberNft = await hre.ethers.getContractFactory("CommunityMemberNft");
    const ethersContractCommunityMemberNft = await factoryCommunityMemberNft.deploy(contractCommunity.getAddress(), uuidMainCommunity);
    await ethersContractCommunityMemberNft.deployed();
    const contractCommunityMemberNft = EthersContract.fromContract(nam, ethersContractCommunityMemberNft);

    await nam.refreshProviderNonces();
    await nam.transferEth(walletOwner, wallet1, 1);
    await nam.transferEth(walletOwner, wallet2, 1);
    await nam.transferEth(walletOwner, wallet3, 1);

    return {
      contractCommunity, contractCommunityMemberNft,
      uuidMainCommunity,
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

  //it's necessary to fix Nonce in NonceManager used in Ethers
  //beforeEach(() => loadFixture(deployTokenFixture).then(fx => fx.nam.refreshProviderNonces()));


  it("Test initial", async () =>
  {
    const fixt = await fixture();
    const amountW1 = await fixt.contractCommunityMemberNft.staticRead().balanceOf(fixt.wallet1.public);
    expect(amountW1).eq(0);

    const hasNft = await fixt.contractCommunityMemberNft.staticRead().hasCommunityNft(fixt.wallet1.public);
    expect(hasNft).eq(false);
  });

  it("Test mint", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity);

    const amountW1 = await fixt.contractCommunityMemberNft.staticRead().balanceOf(fixt.walletOwner.public);
    expect(amountW1.toNumber()).eq(1);

    const hasNft = await fixt.contractCommunityMemberNft.staticRead().hasCommunityNft(fixt.walletOwner.public);
    expect(hasNft).eq(true);
  });

  it("Test mint unknown community", async () =>
  {
    const fixt = await fixture();
    await expect(fixt.contractCommunityMemberNft.direct().mintCommunity("xxxx")).revertedWith("Unknown community ID");
  });

  it("Test mint double", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity);

    const amountW1 = await fixt.contractCommunityMemberNft.staticRead().balanceOf(fixt.walletOwner.public);
    expect(amountW1).eq(1);

    await expect(fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity)).revertedWith("Only one mint allowed");
  });

  it("Test minted info", async () =>
  {
    const fixt = await fixture();
   
    const tx = await fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity);
    const logs = fixt.contractCommunityMemberNft.decodeTransactionLogs(tx);
    const tokenId = logs[0].args.tokenId.toNumber();
    const data = await fixt.contractCommunityMemberNft.staticRead().nftData(tokenId);
    expect(data.communityUuid).eq(fixt.uuidMainCommunity);
  });

  it("Test Uri", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity);
    const logs = fixt.contractCommunityMemberNft.decodeTransactionLogs(tx);
    const tokenId = logs[0].args.tokenId.toNumber();
    const uri = await fixt.contractCommunityMemberNft.staticRead().tokenURI(tokenId);
    expect(uri).eq("baseuritest0");
  });

  it("Test transfer", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.direct().mintCommunity(fixt.uuidMainCommunity);
    const logs = fixt.contractCommunityMemberNft.decodeTransactionLogs(tx);
    const tokenId = logs[0].args.tokenId.toNumber();

    await expect(fixt.contractCommunityMemberNft.direct().transferFrom(fixt.walletOwner.public, fixt.wallet1.public, tokenId)).revertedWith("Soulbound NFT cant be transferred");

    const amountWO = await fixt.contractCommunityMemberNft.staticRead().balanceOf(fixt.walletOwner.public);
    expect(amountWO.toNumber()).eq(1);

    const amountW1 = await fixt.contractCommunityMemberNft.staticRead().balanceOf(fixt.wallet1.public);
    expect(amountW1).eq(0);

    const hasNftO = await fixt.contractCommunityMemberNft.staticRead().hasCommunityNft(fixt.walletOwner.public);
    expect(hasNftO).eq(true);

    const hasNftW1 = await fixt.contractCommunityMemberNft.staticRead().hasCommunityNft(fixt.wallet1.public);
    expect(hasNftW1).eq(false);
  });

});
