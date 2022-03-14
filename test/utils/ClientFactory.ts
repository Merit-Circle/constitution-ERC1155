import { Contract } from "ethers";
import { ethers } from "hardhat";

export class ClientFactory {
  collateralNFT: Contract;

  constructor() {
    // @ts-expect-error work around async initialization
    this.collateralNFT = undefined;
  }

  async init() {
    const collateralNFTFactory = await ethers.getContractFactory("MockCollateralNFT");
    this.collateralNFT = await collateralNFTFactory.deploy("MockCollateralNFT", "MCNFT");
  }

  async create({ address, collateralTokenIds }: { address: string; collateralTokenIds: number[] }) {
    await Promise.all(
      collateralTokenIds.map(async tokenId => {
        await this.collateralNFT.mint(tokenId, address);
      }),
    );
  }
}
