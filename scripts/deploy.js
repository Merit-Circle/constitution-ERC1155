async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const mintableContract = await new Collectibles__factory().deploy(
    "Edenhorde Treasures",
    "EHTR",
    "ipfs://ipfs/QmV7gdtEvxmB7FaBmy855B1JjcD72nqABw5ZFXtZ1hFzTu",
  );

  console.log(`MintableNFT deployed at ${mintableContract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
