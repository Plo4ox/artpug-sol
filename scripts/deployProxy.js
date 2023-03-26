const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ArtPugV1 = await ethers.getContractFactory('ArtPugV1');
  const proxy = await upgrades.deployProxy(ArtPugV1, [600000000000000, 600000000000000], {value: ethers.utils.parseEther("0.2")});
  await proxy.deployed();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxy.address
  );

  console.log('Proxy contract address: ' + proxy.address);
  console.log('Implementation contract address: ' + implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });