import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Contract, ContractTransaction, Wallet } from "ethers";
import hre, { ethers } from "hardhat";
import { EthersWallets } from "./wallets.test";


describe("App/CommunityMemberNft", function ()
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
    const ethersContractCommunity = await factoryCommunity.deploy();
    const contractCommunity = await ethersContractCommunity.deployed();

    const uuidMainCommunity = "1111";
    await contractCommunity.registerCommunity(uuidMainCommunity);

    const factoryCommunityMemberNft = await hre.ethers.getContractFactory("CommunityMemberNft");
    const ethersContractCommunityMemberNft = await factoryCommunityMemberNft.deploy(contractCommunity.address, uuidMainCommunity);
    const contractCommunityMemberNft = await ethersContractCommunityMemberNft.deployed();

    await walletOwner.sendTransaction({ to: wallet1.address, value: ethers.utils.parseEther("1") });
    await walletOwner.sendTransaction({ to: wallet2.address, value: ethers.utils.parseEther("1") });
    await walletOwner.sendTransaction({ to: wallet3.address, value: ethers.utils.parseEther("1") });

    return {
      contractCommunity, contractCommunityMemberNft,
      uuidMainCommunity,
      walletOwner, walletAdmin,
      wallet1, wallet2, wallet3
    };
  }

  async function parseLogsFromTransaction(contract : Contract, tx : ContractTransaction)
  {
    const receipt = await tx.wait();
    const parsedLogs = receipt.logs.map(l => {
      try
      {
        return contract.interface.parseLog(l);
      }
      catch(err:any)
      {
        return undefined;
      }
    });
    return parsedLogs;
  }
  /*
  function decodeTransactionLogs(trans: ContractTransaction ): Array<EthersDecodedLogEvent>
  {
    const iface = this.getInterface();
    return EthersContractCore.decodeExternalTransactionLogs(iface, trans);
  }

  function decodeExternalTransactionLogs(iface: Interface | Array<any>, trans: TransactionReceipt | EthersTransactionCallResult): Array<EthersDecodedLogEvent>
  {
    if ("transactionReceipt" in trans)
      trans = trans.transactionReceipt;

    if (iface instanceof Array)
      iface = new Interface(iface);

    const results: Array<EthersDecodedLogEvent> = new Array();
    for (const log of trans.logs)
    {
      const parsedLog = this.decodeExternalTransactionLog(iface, log);
      if (parsedLog)
        results.push(parsedLog);
    }
    return results;
  }

  function decodeExternalTransactionLog(iface: Interface | Array<any>, log: Log): EthersDecodedLogEvent | undefined
  {
    if (iface instanceof Array)
      iface = new Interface(iface);

    try
    {
      const parsedLog = iface.parseLog(log);
      return {
        log: log,
        parsedLog: parsedLog,
        address: log.address,
        name: parsedLog.name,
        args: parsedLog.args,
      };
    }
    catch (e)
    {
      //unknown event not from this iface
    }
  }*/


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
    expect(amountW1.toNumber()).eq(1);

    const hasNft = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.walletOwner.address);
    expect(hasNft).eq(true);
  });

  it("Test mint unknown community", async () =>
  {
    const fixt = await fixture();
    await expect(fixt.contractCommunityMemberNft.mintCommunity("xxxx"))
      .revertedWithCustomError(fixt.contractCommunityMemberNft,"CommunityMemberNft_UnknownCommunityId");
  });

  it("Test mint double", async () =>
  {
    const fixt = await fixture();
    await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountW1).eq(1);

    await expect(fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity))
      .revertedWithCustomError(fixt.contractCommunityMemberNft,"CommunityMemberNft_OnlyOneMintAllowed");
  });

  it("Test minted info", async () =>
  {
    const fixt = await fixture();

    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft, tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId.toNumber();
    const data = await fixt.contractCommunityMemberNft.nftData(tokenId);
    expect(data.communityUuid).eq(fixt.uuidMainCommunity);
  });

  it("Test Uri", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft,tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId.toNumber();
    const uri = await fixt.contractCommunityMemberNft.tokenURI(tokenId);
    expect(uri).eq("baseuritest0");
  });

  it("Test transfer", async () =>
  {
    const fixt = await fixture();
    const tx = await fixt.contractCommunityMemberNft.mintCommunity(fixt.uuidMainCommunity);
    const logs = await parseLogsFromTransaction(fixt.contractCommunityMemberNft, tx);
    expect(logs.length).gt(0);
    const tokenId = logs[0]!.args.tokenId.toNumber();

    await expect(fixt.contractCommunityMemberNft.transferFrom(fixt.walletOwner.address, fixt.wallet1.address, tokenId))
      .revertedWithCustomError(fixt.contractCommunityMemberNft,"CommunityMemberNft_NotTransferable");

    const amountWO = await fixt.contractCommunityMemberNft.balanceOf(fixt.walletOwner.address);
    expect(amountWO.toNumber()).eq(1);

    const amountW1 = await fixt.contractCommunityMemberNft.balanceOf(fixt.wallet1.address);
    expect(amountW1).eq(0);

    const hasNftO = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.walletOwner.address);
    expect(hasNftO).eq(true);

    const hasNftW1 = await fixt.contractCommunityMemberNft.hasCommunityNft(fixt.wallet1.address);
    expect(hasNftW1).eq(false);
  });

});
