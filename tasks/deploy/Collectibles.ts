import { task } from "hardhat/config";
import { Collectibles__factory, MerkleDrop__factory } from "../../src/types";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 100000;
const IPFS = "ipfs://QmZSZJZSxRGM6e3Zk9vMKJoXgbikUHYFFJ22TM4PMVWTqq/";

task("deploy:collectibles").setAction(async (taskArgs, { ethers, run }) => {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const mintableFactory = new Collectibles__factory(deployer);
  const mintableContract = await mintableFactory.deploy("Edenhorde Collectibles", "EHC", IPFS);

  console.log(mintableContract.address);

  await mintableContract.deployed();
  await sleep(VERIFY_DELAY);

  try {
    await run("verify:verify", {
      address: mintableContract.address,
      constructorArguments: ["Edenhorde Collectibles", "EHC", IPFS],
    });
  } catch (error) {
    console.log(error);
  }

  // fill up to initialise OS properly
  const minterRole = await mintableContract.MINTER_ROLE();

  await mintableContract.grantRole(minterRole, deployer.address);
  await mintableContract.mintBatch([0, 1, 2], [1, 1, 1], deployer.address);
});

task("init:collectibles").setAction(async (taskArgs, { ethers }) => {
  const [deployer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = "0x5B79206A46C336205D62e7122843174e1Bc00d2E";

  const mintableContract = await ethers.getContractAt("Collectibles", CONTRACT_ADDRESS);

  const minterRole = await mintableContract.MINTER_ROLE();

  await mintableContract.grantRole(minterRole, deployer.address);
  await mintableContract.mintBatch([0, 1, 2], [1, 1, 1], deployer.address);
});
