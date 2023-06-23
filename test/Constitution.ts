import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";

import { Constitution, Constitution__factory } from "../src/types";
import { NotEOA, NotEOA__factory } from "../src/types";

let deployer: SignerWithAddress;
let account1: SignerWithAddress;
let NFT: Constitution;
let Attacker: NotEOA;

const NAME = "Constitution";
const SYMBOL = "CON";
const BASE_TOKEN_URI = "https://token-cdn-domain/";

const timeTraveler = new TimeTraveler(hre.network.provider);

let DEFAULT_ADMIN_ROLE: string;
let UPDATER_ROLE: string;

describe("Constitution", function () {
  before(async () => {
    [deployer, account1] = await ethers.getSigners();

    NFT = await new Constitution__factory(deployer).deploy(NAME, SYMBOL, BASE_TOKEN_URI, deployer.address);

    DEFAULT_ADMIN_ROLE = await NFT.DEFAULT_ADMIN_ROLE();
    UPDATER_ROLE = await NFT.UPDATER_ROLE();

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });

  describe("Deployment", async () => {
    it("Correctly setup params", async () => {
      const defaultAdminCount = await NFT.getRoleMemberCount(DEFAULT_ADMIN_ROLE);
      const defaultAdmin = await NFT.getRoleMember(DEFAULT_ADMIN_ROLE, 0);

      const tokenUri = await NFT.uri(0);

      expect(defaultAdminCount).to.eq(1, "Default admin count incorrect");
      expect(defaultAdmin).to.eq(deployer.address, "Default admin incorrect");
      expect(tokenUri).to.eq(BASE_TOKEN_URI);
    });

    it("Correctly mint on deployment", async () => {
      expect(await NFT.balanceOf(deployer.address, 0)).to.eq(1);
      expect(await NFT.mintedCountTotal()).to.eq(1);
    });
  });

  describe("mint", async () => {
    it("can mint a single nft", async () => {
      await NFT.connect(account1).mint();

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.mintedCount(account1.address)).to.eq(1)
      expect(await NFT.mintedCountTotal()).to.eq(2);
    });

    it("errors if already minted", async () => {
      await NFT.connect(account1).mint();

      expect(await NFT.mintedCountTotal()).to.eq(2);

      await expect(NFT.connect(account1).mint()).to.be.revertedWith("AlreadyMintedError()");

      expect(await NFT.balanceOf(account1.address, 0)).to.eq(1);
      expect(await NFT.mintedCountTotal()).to.eq(2);
    });
  });

  describe("setBaseURI", async () => {
    it("Setting the baseURI should work", async () => {
      const baseURI = "69nice";

      await NFT.grantRole(UPDATER_ROLE, account1.address);

      await NFT.connect(account1).setURI(baseURI);

      const newBaseURI = await NFT.uri(0);
      expect(newBaseURI).to.eq(baseURI);
    });

    it("Setting the BaseURI from an address which does not have the default admin role should fail", async () => {
      await expect(NFT.connect(account1).setURI("fail")).to.be.revertedWith("OnlyUpdaterError()");
    });
  });

  describe("onlyEOA", async () => {
    it("Mint constitution with smart contract on deployment should fail", async () => {
      await expect(new NotEOA__factory(deployer).deploy(NFT.address, true)).to.be.revertedWith("OnlyEOAError()");
    });

    it("Mint constitution with smart contract after deployment should fail", async () => {
      Attacker = await new NotEOA__factory(deployer).deploy(NFT.address, false);

      await expect(Attacker.mintConstitution(NFT.address)).to.be.revertedWith("OnlyEOAError()");
    });
  });
});
