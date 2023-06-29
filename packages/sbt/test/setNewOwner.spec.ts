import { expect } from 'chai';
import { deploySBT, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('setNewOwner', () => {
  let params: SBTContractParams;
  let contract: SBT;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    owner = (await ethers.getSigners())[0];
    signers = (await ethers.getSigners()).slice(1);
    params = {
      owner,
      tokens: [
        { id: 0, uri: 'Token0', maxAmount: 2 },
        { id: 1, uri: 'Token1', maxAmount: 2 },
        { id: 2, uri: 'Token2', maxAmount: 2 },
      ],
    };
    contract = await deploySBT(params);
  });

  it('owner changed', async () => {
    const newOwner = signers[0].address;
    await contract.setNewOwner(newOwner);
    const contractOwner = await contract._owner();
    expect(contractOwner).to.be.equal(newOwner);
  });

  it('not owner', async () => {
    const newOwner = signers[0].address;
    await expect(contract.connect(signers[1]).setNewOwner(newOwner)).to.be.revertedWith('not owner');
    const contractOwner = await contract._owner();
    expect(contractOwner).to.be.equal(owner.address);
  });
});
