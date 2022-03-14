import { ethers } from "ethers";
import { MerkleTree } from "./MerkleTree";

class DropMerkleTree {
  merkleTree: MerkleTree;

  constructor(addresses: string[], tokenIds: number[][]) {
    const hashes = addresses.map((address, i) => this.hashEntry(address, tokenIds[i]));

    this.merkleTree = new MerkleTree(hashes);
  }

  hashEntry(address: string, tokenIds: number[]) {
    return ethers.utils.solidityKeccak256(["uint256[]", "address"], [tokenIds, address]);
  }

  getProofByAddressAndTokenId = (address: string, tokenIds: number[]) => {
    const hash = this.hashEntry(address, tokenIds);
    return this.merkleTree.getProof(hash);
  };
}

export default DropMerkleTree;
