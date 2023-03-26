# ArtPugV1

The contract defines an application used to create contests between images.
Each entry adds to the reward pool and the winner get all the gains!

## Setup

Be sure to create a .env file with the following variables to be able to deploy the contract
`ALCHEMY_SEPOLIA_URL` : Alchemy Sepolia address provider
`ACCOUNT_PRIVATE_KEY` : Private Key of the account used to deploy the contract

## Deploy the contract

To deploy the contract use the "deployProxy.js" script. 
It will deploy a proxy which allows the upgrade of the smart contract, if needed.

It can be deployed on any network with the followin command:
`npx hardhat run --network <MY_NETWORK> scripts/deployProxy.js`

The contract has been deployed here:
https://sepolia.etherscan.io/address/0x9305f73a9b803510851f9625D37C3B802ab20593

## Testing

A script has been created to test the contract be sure to launch it, before any deployement.
This can be done with the following command line.
`npx hardhat test test/artPugV1Tests.js`

## Default webapp

A web app has been created to interact with this contract here:
https://www.plo4ox.com/tmp-project/ArtPug2023/