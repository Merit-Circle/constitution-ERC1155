import hre, { ethers } from "hardhat";

import { Constitution, Constitution__factory } from "../src/types";

const NAME = "Constitution";
const SYMBOL = "CON";
const BASE_TOKEN_URI = "";
const UPDATER = "";

async function deployConstitution() {
  const signers = await ethers.getSigners();

  const deployer = signers[0];
  console.log("Deployer: ", deployer.address);

  let constitution: Constitution;

  const Constitution = new Constitution__factory(deployer);

  const constructorParams = [
    NAME,
    SYMBOL,
    BASE_TOKEN_URI,
    deployer.address
  ]

  console.log("Deploying Constitution...");
  constitution = await Constitution.deploy(
    NAME,
    SYMBOL,
    BASE_TOKEN_URI,
    deployer.address
  );
  await constitution.deployed();
  console.log("Constitution deployed at", constitution.address);

  console.log("Assigning UPDATER_ROLE...");
  const UPDATER_ROLE: string = await constitution.UPDATER_ROLE();
  await (await constitution.grantRole(UPDATER_ROLE, UPDATER)).wait(1);
  console.log("UPDATER_ROLE assigned to", UPDATER);

  try {
    await hre.run("verify:verify", {
        address: constitution.address,
        constructorArguments: constructorParams
    });
  } catch (e) {
      console.log(e);
  }
}

deployConstitution().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});