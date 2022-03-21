import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";

import { Collectibles, Collectibles__factory } from "../src/types";

let deployer: SignerWithAddress;
let account1: SignerWithAddress;
let NFT: Collectibles;

const NAME = "Collectible";
const SYMBOL = "COL";
const BASE_TOKEN_URI = "https://token-cdn-domain/";

const timeTraveler = new TimeTraveler(hre.network.provider);

let DEFAULT_ADMIN_ROLE: string;
let MINTER_ROLE: string;
let BURNER_ROLE: string;

describe("Collectibles", function () {
  before(async () => {
    [deployer, account1] = await ethers.getSigners();

    NFT = await new Collectibles__factory(deployer).deploy(NAME, SYMBOL, BASE_TOKEN_URI);

    DEFAULT_ADMIN_ROLE = await NFT.DEFAULT_ADMIN_ROLE();
    MINTER_ROLE = await NFT.MINTER_ROLE();
    BURNER_ROLE = await NFT.BURNER_ROLE();

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });

  describe("Deployment", async () => {
    it("Correctly setup params", async () => {
      const defaultAdminCount = await NFT.getRoleMemberCount(DEFAULT_ADMIN_ROLE);
      const defaultAdmin = await NFT.getRoleMember(DEFAULT_ADMIN_ROLE, 0);

      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mintBatch([0, 1, 2], [1, 0, 0], account1.address);

      const tokenUri = await NFT.uri(0);

      expect(defaultAdminCount).to.eq(1, "Default admin cound incorrect");
      expect(defaultAdmin).to.eq(deployer.address, "Default admin incorrect");
      expect(tokenUri).to.eq(`${BASE_TOKEN_URI}0.json`);
    });
  });

  describe("mint", async () => {
    it("can mint a single nft", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mint(account1.address, 1, 1);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("can mint multiple nfts of same type", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mint(account1.address, 1, 10);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(10);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("Minting from an address which does not have the minter role should fail", async () => {
      await expect(NFT.mint(account1.address, 1, 10)).to.be.revertedWith("OnlyMinterError()");
    });
  });

  describe("mintBatch", async () => {
    it("can mint a single nft", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mintBatch([0, 1, 2], [1, 0, 0], account1.address);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("can mint multiple nfts", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mintBatch([0, 1, 2], [10, 0, 5], account1.address);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(10);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(5);
    });

    it("Minting from an address which does not have the minter role should fail", async () => {
      await expect(NFT.mintBatch([0, 1, 2], [1, 0, 0], account1.address)).to.be.revertedWith("OnlyMinterError()");
    });

    it("Mint arbitrary token type", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);

      await NFT.mintBatch([100], [1], account1.address);

      expect(await NFT.balanceOf(account1.address, 100)).to.eq(1);
    });
  });

  describe("burn", async () => {
    it("can burn a single nft", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mint(account1.address, 1, 1);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);

      await NFT.grantRole(BURNER_ROLE, deployer.address);
      await NFT.burn(account1.address, 1, 1);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("can burn multiple nfts of same type", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mint(account1.address, 1, 10);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(10);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);

      await NFT.grantRole(BURNER_ROLE, deployer.address);
      await NFT.burn(account1.address, 1, 5);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(5);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("Burning from an address which does not have the minter role should fail", async () => {
      await expect(NFT.burn(account1.address, 1, 10)).to.be.revertedWith("OnlyBurnerError()");
    });
  });

  describe("burnBatch", () => {
    it("Burn tokenId after minting", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mintBatch([0, 1, 2], [1, 0, 0], account1.address);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);

      await NFT.grantRole(BURNER_ROLE, deployer.address);
      await NFT.burnBatch([0, 1, 2], [1, 0, 0], account1.address);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("Burn tokenId after minting 2", async () => {
      await NFT.grantRole(MINTER_ROLE, deployer.address);
      await NFT.mintBatch([0, 1, 2], [1, 0, 0], account1.address);

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);

      await NFT.grantRole(BURNER_ROLE, deployer.address);
      await expect(NFT.burnBatch([0, 1, 2], [1, 1, 1], account1.address)).to.be.reverted;

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.balanceOf(account1.address, 1)).to.eq(0);
      expect(await NFT.balanceOf(account1.address, 2)).to.eq(0);
    });

    it("Reverts when not burner role", async () => {
      await expect(NFT.burnBatch([0, 1, 2], [1, 0, 0], account1.address)).to.be.revertedWith("OnlyBurnerError()");
    });

    it("Reverts when trying to burn non existent token", async () => {
      await NFT.grantRole(BURNER_ROLE, deployer.address);

      await expect(NFT.burnBatch([0, 1, 2], [1, 0, 0], account1.address)).to.be.reverted;
    });
  });

  describe("setBaseURI", async () => {
    it("Setting the baseURI should work", async () => {
      const baseURI = "69nice";
      await NFT.setURI(baseURI);

      const newBaseURI = await NFT.uri(0);
      expect(newBaseURI).to.eq(`${baseURI}0.json`);
    });

    it("Setting the BaseURI from an address which does not have the default admin role should fail", async () => {
      await expect(NFT.connect(account1).setURI("fail")).to.be.revertedWith("OnlyAdminError()");
    });
  });
});
