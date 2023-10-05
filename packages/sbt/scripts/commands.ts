import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import * as fs from 'fs';
import { BigNumberish } from 'ethers';

import { SBT, SBT__factory } from '../typechain-types';

task('sbt:transfer-ownership')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('owner', 'The owner address.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tx = await contract.transferOwnership(args.owner);
    await tx.wait();

    const owner = await contract.owner();

    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('sbt:mint')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('metadataFile', 'The file containing the following JSON structure [{id:number,metadata:string}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tokensMetadata: TokenMetadata[] = JSON.parse(fs.readFileSync(args.metadataFile, 'utf-8'));

    const tokens = tokensMetadata.map((tm) => tm.id);
    const metadata = tokensMetadata.map((tm) => tm.metadata);

    const tx = await contract.mint(tokens, metadata);
    await tx.wait();

    console.log('Tokens has been successfully minted', tokensMetadata);
  });

task('sbt:award')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('winnersFile', 'The file containing the following JSON structure [{to:string,id:number,amount:number}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const winners: TokenWinner[] = JSON.parse(fs.readFileSync(args.winnersFile, 'utf-8'));

    const to = winners.map((w) => w.to);
    const ids = winners.map((tm) => tm.id);
    const amounts = winners.map((w) => w.amount);

    const tx = await contract.award(to, ids, amounts);
    await tx.wait();

    console.log(`The tokens has been successfully awarded to the winners.`, winners);
  });

task('sbt:burn')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('id', 'The token id being burned.')
  .addParam('amount', 'The amount of token being burned.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tx = await contract.burn(args.id, args.amount);
    await tx.wait();

    console.log(`The amount of token ${id} has been successsfully decreased by ${amount}`);
  });

function initSbtContract(hre: HardhatRuntimeEnvironment, pk: string, contract: string): SBT {
  const provider = new hre.ethers.JsonRpcProvider((hre.network.config as any).url);
  const signer = new hre.ethers.Wallet(pk, provider);
  const sbt = SBT__factory.connect(contract, signer);

  return sbt;
}

interface TokenMetadata {
  id: BigNumberish;
  metadata: string;
}

interface TokenWinner {
  to: string;
  id: BigNumberish;
  amount: BigNumberish;
}