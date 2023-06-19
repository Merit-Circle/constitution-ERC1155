import { task } from "hardhat/config";
import { Constitution__factory } from "../../src/types";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 100000;
const IPFS = "ipfs://QmZSZJZSxRGM6e3Zk9vMKJoXgbikUHYFFJ22TM4PMVWTqq/";

task("deploy:constitution").setAction(async (taskArgs, { ethers, run }) => {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const mintableFactory = new Constitution__factory(deployer);

  const mintableContract = await mintableFactory.deploy("Merit Circle Constitution", "MCC", IPFS);

  console.log(mintableContract.address);

  await mintableContract.deployed();
  await sleep(VERIFY_DELAY);

  try {
    await run("verify:verify", {
      address: mintableContract.address,
      constructorArguments: ["Merit Circle Constitution", "MCC", IPFS],
    });
  } catch (error) {
    console.log(error);
  }

  // fill up to initialise OS properly
  await mintableContract.mint()
});
