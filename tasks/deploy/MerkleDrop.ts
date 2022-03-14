import { task } from "hardhat/config";
import { Collectibles__factory, MerkleDrop__factory } from "../../src/types";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 100000;

task("deploy:merkledrop").setAction(async (taskArgs, { ethers, run }) => {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const merkleDropFactory = new MerkleDrop__factory(deployer);
  const merkleDropContract = await merkleDropFactory.deploy();

  console.log(merkleDropContract.address);

  await merkleDropContract.deployed();

  await sleep(VERIFY_DELAY);
  try {
    await run("verify:verify", {
      address: merkleDropContract.address,
      constructorArguments: [],
    });
  } catch (error) {
    console.log("error verifying");
  }
});

task("init:merkledrop").setAction(async (taskArgs, { ethers, run }) => {
  const [deployer] = await ethers.getSigners();

  const MERKLE_ROOT = "0x3ded3d1ceb248decd827d8f3d82ffddd7d845a3b15b04362d993a1cfd3c61187";
  const COLLECTIBLE_ADDRESS = "0x5B79206A46C336205D62e7122843174e1Bc00d2E";
  const COLLATERAL_ADDRESS = "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b";
  const MERKLEDROP_ADDRESS = "0x0D93a92e088655088d4fCc8aa135E226E7482d24";

  const merkleDropContract = await ethers.getContractAt("MerkleDrop", MERKLEDROP_ADDRESS);
  const mintableContract = await ethers.getContractAt("Collectibles", COLLECTIBLE_ADDRESS);

  const minterRole = await mintableContract.MINTER_ROLE();

  const merkleSetterRole = await merkleDropContract.MERKLE_SETTER_ROLE();
  const claimedSetterRole = await merkleDropContract.CLAIMED_SETTER_ROLE();

  await merkleDropContract.grantRole(claimedSetterRole, deployer.address);
  await merkleDropContract.grantRole(merkleSetterRole, deployer.address);
  await merkleDropContract.updateNFTMerkleTree(MERKLE_ROOT, "");

  await mintableContract.grantRole(minterRole, merkleDropContract.address);

  await merkleDropContract.updateCollateralAddress(COLLATERAL_ADDRESS);
  await merkleDropContract.updateMintableAddress(mintableContract.address);
});
