import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers } from 'ethers';


// TODO what a proper conversion of uint256?
const nUsers = Buffer.from(process.argv[2]).readInt32BE();

const leafs: string[][] = [];
for (let i = 0; i < nUsers; i++) {
    const address = Buffer.from(process.argv[3 + i * 2]).toString();
    const amount = Buffer.from(process.argv[4 + i * 2]).toString();
    leafs.push([address, amount]);
}

// TODO why they use bytes32 here https://github.com/dmfxyz/murky/blob/main/differential_testing/scripts/generate_complete_proof.ts#L10
const tree = StandardMerkleTree.of(leafs, ["address", "uint256"], { sortLeaves: false });

const toEncodeTypes: string[] = ["bytes32"];
const toEncodeValues: string[] = [tree.root];


for (let i = 0; i < nUsers; i++) {
    toEncodeTypes.push("bytes32[]");
    toEncodeValues.push(tree.getProof(i))
}

process.stdout.write(ethers.utils.defaultAbiCoder.encode(toEncodeTypes, toEncodeValues))