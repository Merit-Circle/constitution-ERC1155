import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers, network } from "hardhat";
import { Collectibles, MerkleDrop, MerkleDrop__factory, Collectibles__factory } from "../src/types";
import TimeTraveler from "../utils/TimeTraveler";
import DropMerkleTree from "../utils/DropMerkleTree";
import { constants } from "ethers";
import { ClientFactory } from "./utils/ClientFactory";
import { ehHolders } from "./__fixtures__/ehHolders";

let deployer: SignerWithAddress;
let account1: SignerWithAddress;
let signers: SignerWithAddress[];
let timeTraveler: TimeTraveler;
let merkleDropContract: MerkleDrop;
let mintableContract: Collectibles;

const clientFactory = new ClientFactory();

const NAME = "NAME";
const SYMBOL = "SYMBOL";
const BASE_TOKEN_URI = "https://token-cdn-domain/";
const IPFS_HASH = "hash";
const EDENHORDE_ADDRESS = "0x9eEAeCBE2884AA7e82f450E3Fc174F30Fc2a8de3";

const merkleDropRoles = {
  DEFAULT_ADMIN_ROLE: "",
  MERKLE_SETTER_ROLE: "",
  CLAIMED_SETTER_ROLE: ""
};

const nftRoles = {
  DEFAULT_ADMIN_ROLE: "",
  MINTER_ROLE: "",
  BURNER_ROLE: "",
};

describe("MerkleDrop", function () {
  describe("deploy", () => {
    it("correctly initializes", async () => {
      const [deployer, ..._signers] = await ethers.getSigners();

      const merkleDropContract = await new MerkleDrop__factory(deployer).deploy();

      merkleDropRoles.DEFAULT_ADMIN_ROLE = await merkleDropContract.DEFAULT_ADMIN_ROLE();
      merkleDropRoles.MERKLE_SETTER_ROLE = await merkleDropContract.MERKLE_SETTER_ROLE();
      merkleDropRoles.CLAIMED_SETTER_ROLE = await merkleDropContract.CLAIMED_SETTER_ROLE();

      const defaultAdmin = await merkleDropContract.getRoleMember(merkleDropRoles.DEFAULT_ADMIN_ROLE, 0);

      expect(defaultAdmin).to.equal(deployer.address);

      expect(await merkleDropContract.mintableAddress()).to.equal(constants.AddressZero);
      expect(await merkleDropContract.collateralAddress()).to.equal(constants.AddressZero);
    });
  });

  describe("hardhat network", () => {
    let addresses: string[];
    let tokenIdsByAddresses: number[][];
    let merkleTree: DropMerkleTree;

    before(async () => {
      [deployer, account1, ...signers] = await ethers.getSigners();

      merkleDropContract = await new MerkleDrop__factory(deployer).deploy();
      mintableContract = await new Collectibles__factory(deployer).deploy(NAME, SYMBOL, BASE_TOKEN_URI);

      merkleDropRoles.DEFAULT_ADMIN_ROLE = await merkleDropContract.DEFAULT_ADMIN_ROLE();
      merkleDropRoles.MERKLE_SETTER_ROLE = await merkleDropContract.MERKLE_SETTER_ROLE();

      nftRoles.DEFAULT_ADMIN_ROLE = await mintableContract.DEFAULT_ADMIN_ROLE();
      nftRoles.MINTER_ROLE = await mintableContract.MINTER_ROLE();
      nftRoles.BURNER_ROLE = await mintableContract.BURNER_ROLE();

      // fill dummy merkle tree
      addresses = signers.map(value => value.address);
      tokenIdsByAddresses = signers.map((value, index) => {
        // default to minting one of each
        return [1, 1, 1];
      });

      merkleTree = new DropMerkleTree(addresses, tokenIdsByAddresses);

      await merkleDropContract.grantRole(merkleDropRoles.CLAIMED_SETTER_ROLE, deployer.address);
      await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);
      await merkleDropContract.updateNFTMerkleTree(merkleTree.merkleTree.getRoot(), IPFS_HASH);

      await mintableContract.grantRole(nftRoles.MINTER_ROLE, merkleDropContract.address);

      // deploys fake collateral contract
      await clientFactory.init();

      await merkleDropContract.updateCollateralAddress(clientFactory.collateralNFT.address);
      await merkleDropContract.updateMintableAddress(mintableContract.address);

      timeTraveler = new TimeTraveler(hre.network.provider);
      await timeTraveler.snapshot();
    });

    beforeEach(async () => {
      await timeTraveler.revertSnapshot();
    });

    describe("updateCollateralAddress", () => {
      it("correctly sets address", async () => {
        expect(await merkleDropContract.collateralAddress()).to.equal(clientFactory.collateralNFT.address);

        await merkleDropContract.updateCollateralAddress(constants.AddressZero);

        expect(await merkleDropContract.collateralAddress()).to.equal(constants.AddressZero);
      });

      it("fails if not correct role", async () => {
        await expect(
          merkleDropContract.connect(account1).updateCollateralAddress(constants.AddressZero),
        ).to.be.revertedWith("OnlyAdminError()");
      });
    });

    describe("updateMintableAddress", () => {
      it("correctly sets address", async () => {
        expect(await merkleDropContract.mintableAddress()).to.equal(mintableContract.address);

        await merkleDropContract.updateMintableAddress(constants.AddressZero);

        expect(await merkleDropContract.mintableAddress()).to.equal(constants.AddressZero);
      });

      it("fails if not correct role", async () => {
        await expect(
          merkleDropContract.connect(account1).updateMintableAddress(constants.AddressZero),
        ).to.be.revertedWith("OnlyAdminError()");
      });
    });

    describe("updateMerkleTree", async () => {
      it("sets merkle tree", async () => {
        await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);

        const newRoot = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0";
        const newHash = "kekekekek";

        await merkleDropContract.updateNFTMerkleTree(newRoot, newHash);
        const newMerkleTree = await merkleDropContract.merkleTree();

        expect(newMerkleTree.root).to.eq(newRoot);
        expect(newMerkleTree.ipfsHash).to.eq(newHash);
      });

      it("fails if not correct role", async () => {
        const newRoot = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0";
        const newHash = "kekekekek";

        await expect(merkleDropContract.connect(account1).updateNFTMerkleTree(newRoot, newHash)).to.be.revertedWith(
          "OnlyMerkleSetterError()",
        );
      });
    });

    describe("getClaimCount", () => {
      it("correctly updates count", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        expect(await clientFactory.collateralNFT.balanceOf(signers[0].address)).to.equal(3);

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await merkleDropContract.getClaimCount(signers[0].address)).to.eq(3);
      });

      it("returns 0 if nothing claimed yet", async () => {
        expect(await merkleDropContract.getClaimCount(signers[0].address)).to.eq(0);
      });
    });

    describe("updateClaimedAmount", () => {
      it("updates claimed amount properly", async() => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await merkleDropContract.getClaimCount(signers[0].address)).to.eq(3);

        await merkleDropContract.updateClaimedAmount(signers[0].address, 0);

        expect(await merkleDropContract.getClaimCount(signers[0].address)).to.eq(0);
      });

      it("fails if not correct role", async () => {
        await expect(merkleDropContract.connect(account1).updateClaimedAmount(account1.address, 1)).to.be.revertedWith(
          "OnlyClaimedSetterError()",
        );
      });
    })

    describe("claim", async () => {
      it("can claim multiple mintable nfts", async () => {
        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        expect(await clientFactory.collateralNFT.balanceOf(signers[0].address)).to.equal(3);

        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);
      });

      it("does not increase balance when claiming twice", async () => {
        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        expect(await clientFactory.collateralNFT.balanceOf(signers[0].address)).to.equal(3);

        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);

        await expect(merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "ClaimingMoreThanAllowedError()",
        );

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);
      });

      it("reverts when providing invalid proof", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[1].address, [1, 1, 1]);

        await expect(merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "MerkleProofError()",
        );
      });

      it("reverts if override exists initial", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        await expect(merkleDropContract.claim([1, 1, 2], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "MoreThanAllocatedError()",
        );

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);
      });

      it("reverts when claiming invalid token type", async () => {
        const newMerkleTree = new DropMerkleTree([signers[0].address], [[1, 1, 1, 1]]);

        await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);
        await merkleDropContract.updateNFTMerkleTree(newMerkleTree.merkleTree.getRoot(), IPFS_HASH);

        const proof = newMerkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2, 3],
        });

        await expect(merkleDropContract.claim([1, 1, 1, 1], [1, 1, 1, 1], signers[0].address, proof)).to.be.reverted;

        expect(await mintableContract.balanceOf(account1.address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(account1.address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(account1.address, 2)).to.eq(0);
        expect(await mintableContract.balanceOf(account1.address, 3)).to.eq(0);
      });

      it("claims 100 nfts", async () => {
        const newMerkleTree = new DropMerkleTree([signers[0].address], [[34, 33, 33]]);

        await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);
        await merkleDropContract.updateNFTMerkleTree(newMerkleTree.merkleTree.getRoot(), IPFS_HASH);

        const proof = newMerkleTree.getProofByAddressAndTokenId(signers[0].address, [34, 33, 33]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [...Array(100).keys()],
        });

        await merkleDropContract.claim([34, 33, 33], [34, 33, 33], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(34);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(33);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(33);

        // reset merkle tree
        await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);
        await merkleDropContract.updateNFTMerkleTree(merkleTree.merkleTree.getRoot(), IPFS_HASH);
      });

      it("reverts if not enough collateral", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1],
        });

        await expect(merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "InsufficientCollateralError()",
        );
      });

      it("allows to mint in multiple batches", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        await merkleDropContract.claim([1, 0, 0], [1, 1, 1], signers[0].address, proof);
        await merkleDropContract.claim([0, 1, 0], [1, 1, 1], signers[0].address, proof);
        await merkleDropContract.claim([0, 0, 1], [1, 1, 1], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);
      });

      it("reverts if exceeding collateral in multiple batches", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        await merkleDropContract.claim([1, 1, 0], [1, 1, 1], signers[0].address, proof);
        await expect(merkleDropContract.claim([0, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "ClaimingMoreThanAllowedError()",
        );

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);
      });

      it("does not allow to mint more after transfer", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2],
        });

        expect(await clientFactory.collateralNFT.balanceOf(signers[0].address)).to.equal(3);

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);

        await mintableContract.grantRole(nftRoles.BURNER_ROLE, deployer.address);
        await mintableContract.burnBatch([0, 1, 2], [1, 1, 1], signers[0].address);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);

        await expect(merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "ClaimingMoreThanAllowedError",
        );

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);
      });

      it("does not allow to mint more after transfer and more than max allowed", async () => {
        const proof = merkleTree.getProofByAddressAndTokenId(signers[0].address, [1, 1, 1]);

        await clientFactory.create({
          address: signers[0].address,
          collateralTokenIds: [0, 1, 2, 4, 5, 6],
        });

        await merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(1);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(1);

        await mintableContract.grantRole(nftRoles.BURNER_ROLE, deployer.address);
        await mintableContract.burnBatch([0, 1, 2], [1, 1, 1], signers[0].address);

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);

        await expect(merkleDropContract.claim([1, 1, 1], [1, 1, 1], signers[0].address, proof)).to.be.revertedWith(
          "ClaimingMoreThanAllowedError",
        );

        expect(await mintableContract.balanceOf(signers[0].address, 0)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 1)).to.eq(0);
        expect(await mintableContract.balanceOf(signers[0].address, 2)).to.eq(0);
      });
    });
  });

  // describe("mainnet network", () => {
  //   let addresses: string[];
  //   let tokenIdsByAddresses: number[][];
  //   let merkleTree: DropMerkleTree;

  //   before(async () => {
  //     await network.provider.request({
  //       method: "hardhat_reset",
  //       params: [
  //         {
  //           forking: {
  //             jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
  //             blockNumber: 14345261,
  //           },
  //         },
  //       ],
  //     });

  //     [deployer, account1, ...signers] = await ethers.getSigners();

  //     merkleDropContract = await new MerkleDrop__factory(deployer).deploy();
  //     mintableContract = await new Collectibles__factory(deployer).deploy(NAME, SYMBOL, BASE_TOKEN_URI);

  //     merkleDropRoles.DEFAULT_ADMIN_ROLE = await merkleDropContract.DEFAULT_ADMIN_ROLE();
  //     merkleDropRoles.MERKLE_SETTER_ROLE = await merkleDropContract.MERKLE_SETTER_ROLE();

  //     nftRoles.DEFAULT_ADMIN_ROLE = await mintableContract.DEFAULT_ADMIN_ROLE();
  //     nftRoles.MINTER_ROLE = await mintableContract.MINTER_ROLE();
  //     nftRoles.BURNER_ROLE = await mintableContract.BURNER_ROLE();

  //     // fill dummy merkle tree
  //     let tokenCount = 0;
  //     const aggregation = ehHolders.reduce<{ addresses: string[]; tokenIds: number[][] }>(
  //       (prev, cur) => {
  //         const tokens = [];
  //         const max = tokenCount + cur.amount;

  //         for (tokenCount; tokenCount < max; tokenCount++) {
  //           tokens.push(tokenCount);
  //         }

  //         return {
  //           addresses: [...prev.addresses, cur.address.toLowerCase()],
  //           tokenIds: [...prev.tokenIds, tokens],
  //         };
  //       },
  //       {
  //         addresses: [],
  //         tokenIds: [],
  //       },
  //     );

  //     addresses = aggregation.addresses;
  //     tokenIdsByAddresses = aggregation.tokenIds;

  //     merkleTree = new DropMerkleTree(addresses, tokenIdsByAddresses);

  //     await merkleDropContract.grantRole(merkleDropRoles.MERKLE_SETTER_ROLE, deployer.address);
  //     await merkleDropContract.updateNFTMerkleTree(merkleTree.merkleTree.getRoot(), IPFS_HASH);

  //     await mintableContract.grantRole(nftRoles.MINTER_ROLE, merkleDropContract.address);

  //     // deploys fake collateral contract
  //     await clientFactory.init();

  //     await merkleDropContract.updateCollateralAddress(EDENHORDE_ADDRESS);
  //     await merkleDropContract.updateMintableAddress(mintableContract.address);

  //     timeTraveler = new TimeTraveler(hre.network.provider);
  //     await timeTraveler.snapshot();
  //   });

  //   beforeEach(async () => {
  //     await timeTraveler.revertSnapshot();
  //   });

  //   after(async () => {
  //     await network.provider.request({
  //       method: "hardhat_reset",
  //       params: [],
  //     });
  //   });

  //   describe("claim", async () => {
  //     it("can claim", async () => {
  //       const address = addresses[1];
  //       const mintableTokenIds = tokenIdsByAddresses[1];
  //       const proof = merkleTree.getProofByAddressAndTokenId(address, mintableTokenIds);

  //       await merkleDropContract.claim(mintableTokenIds, [0, 1], address, proof);

  //       expect((await mintableContract.ownerOf(mintableTokenIds[0])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[1])).toLowerCase()).to.eq(address);

  //       expect(await mintableContract.getTokenType(mintableTokenIds[0])).to.equal(0);
  //       expect(await mintableContract.getTokenType(mintableTokenIds[1])).to.equal(1);

  //       expect(await mintableContract.balanceOf(address)).to.equal(2);
  //     });

  //     it("does not claim more than collateral", async () => {
  //       const address = addresses[2];
  //       const mintableTokenIds = tokenIdsByAddresses[2];
  //       const proof = merkleTree.getProofByAddressAndTokenId(address, mintableTokenIds);

  //       await merkleDropContract.claim(mintableTokenIds, new Array(mintableTokenIds.length).fill(0), address, proof);

  //       expect((await mintableContract.ownerOf(mintableTokenIds[0])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[1])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[2])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[3])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[4])).toLowerCase()).to.eq(address);
  //       expect((await mintableContract.ownerOf(mintableTokenIds[5])).toLowerCase()).to.eq(address);

  //       await expect(mintableContract.ownerOf(mintableTokenIds[6])).to.be.reverted;
  //       expect(await mintableContract.balanceOf(address)).to.equal(6);
  //     });
  //   });
  // });
});
