/*import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BaseContract, Contract, ContractTransaction, ContractTransactionResponse, Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "../wallets.test";


describe("App/V1/CommunityMemberNft", function ()
{
  async function fixtureDeploy()
  {
    const [owner] = await hre.ethers.getSigners();
    const walletOwner = owner;
    const walletAdmin = new Wallet(EthersWallets.devWalletGanache02.private!, owner.provider);
    const wallet1 = new Wallet(EthersWallets.devWalletGanache03.private!, owner.provider);
    const wallet2 = new Wallet(EthersWallets.devWalletGanache04.private!, owner.provider);
    const wallet3 = new Wallet(EthersWallets.devWalletGanache05.private!, owner.provider);

    const factoryCommunity = await hre.ethers.getContractFactory("CommunityManager");
    const contractCommunity = await factoryCommunity.deploy();

    const uuidMainCommunity = "1111";
    await contractCommunity.registerCommunity(uuidMainCommunity);

    const factoryCommunityMemberNft = await hre.ethers.getContractFactory("CommunityMemberNft");
    const contractCommunityMemberNft = await factoryCommunityMemberNft.deploy(await contractCommunity.getAddress(), uuidMainCommunity);

    await walletOwner.sendTransaction({ to: wallet1.address, value: ethers.parseEther("1") });
    await walletOwner.sendTransaction({ to: wallet2.address, value: ethers.parseEther("1") });
    await walletOwner.sendTransaction({ to: wallet3.address, value: ethers.parseEther("1") });

    return {
      contractCommunity, contractCommunityMemberNft,
      uuidMainCommunity,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function parseLogsFromTransaction(contract: BaseContract, tx: ContractTransactionResponse)
  {
    const receipt = await tx.wait();
    if ( !receipt)
      return [];
    
    const parsedLogs = receipt.logs.map(l =>
    {
      try
      {
        return contract.interface.parseLog(l);
      }
      catch (err: any)
      {
        return undefined;
      }
    });
    return parsedLogs;
  }

  async function fixture()
  {
    const fixt = await loadFixture(fixtureDeploy);
    return fixt;
  }

  it("Test initial", async () =>
  {
    const fixt = await fixture();
    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.wallet1.address);
    expect(amountW1).eq(0);

    const hasNft = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.wallet1.address);
    expect(hasNft).eq(false);
  });

  it("Test mint", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountW1).eq(1);

    const hasNft = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.walletOwner.address);
    expect(hasNft).eq(true);
  });

  it("Test multi mint", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.massMintCommunity(
      fixt.uuidMainCommunity,
      [fixt.wallet1.address, fixt.wallet2.address]
    );

    const amountWO = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountWO).eq(0);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.wallet1.address);
    expect(amountW1).eq(1);

    const amountW2 = await fixt.contractCommunityMemberNft.balanceOf(fixt.wallet2.address);
    expect(amountW2).eq(1);

    const hasNft = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.walletOwner.address);
    expect(hasNft).eq(false);

    const hasNft1 = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.wallet1.address);
    expect(hasNft1).eq(true);

    const hasNft2 = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.wallet2.address);
    expect(hasNft2).eq(true);

    const index1 = await fixt.contractCommunityMemberNft.tokenOfOwnerByIndex(fixt.wallet1.address, 0);
    expect(index1).eq(1);

    const index2 = await fixt.contractCommunityMemberNft.tokenOfOwnerByIndex(fixt.wallet2.address, 0);
    expect(index2).eq(2);
  });

  it("Test mint unknown community", async () =>
  {
    const fixt = await fixture();
    await expect(fixt.contractCommunityMemberNft.mintCommunity("xxxx"))
      .revertedWithCustomError(fixt.contractCommunityMemberNft, "CommunityMemberNft_UnknownCommunityId");
  });

  it("Test mint double", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountW1).eq(1);

    await expect(fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity))
      .revertedWithCustomError(fixt.contractCommunityMemberNft, "CommunityMemberNft_OnlyOneMintAllowed");
  });

  it("Test minted info", async () =>
  {
    const fixt = await fixture();

    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft, tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId;
    const data = await fixt.contractCommunityMemberNft.nftData(tokenId);
    expect(data.communityUuid).eq(fixt.uuidMainCommunity);
  });

  it("Test transfer", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft, tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId;

    await expect(fixt.contractCommunityMemberNft.transferFrom(fixt.walletOwner.address, fixt.wallet1.address, tokenId))
      .revertedWithCustomError(fixt.contractCommunityMemberNft, "CommunityMemberNft_NotTransferable");

    const amountWO = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountWO).eq(1);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.wallet1.address);
    expect(amountW1).eq(0);

    const hasNftO = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.walletOwner.address);
    expect(hasNftO).eq(true);

    const hasNftW1 = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.wallet1.address);
    expect(hasNftW1).eq(false);
  });

  it("Test Uri", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft, tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId;
    const uri = await fixt.contractCommunityMemberNft.tokenURI(tokenId);
    expect(uri).eq("https://api-testnet.angelssquad.com/nft/member?id=1");
  });

  it("Nft metadata", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);

    const amountWO = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountWO).eq(1);

    const index = await fixt.contractCommunityMemberNft.tokenOfOwnerByIndex(fixt.walletOwner.address, 0);
    expect(index).eq(1);

    const ownerAddress = await fixt.contractCommunityMemberNft.ownerOf(1);
    expect(ownerAddress).eq(fixt.walletOwner.address);

    const uri = await fixt.contractCommunityMemberNft.tokenURI(1);
    expect(uri).eq("https://api-testnet.angelssquad.com/nft/member?id=1");
  });

});
*/