import { expect } from 'chai';
import { deploySBT, MintBurnParam, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('transfer', () => {
  let params: SBTContractParams;
  let contract: SBT;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];
  let mintParams: MintBurnParam[];

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

    mintParams = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await contract.mint(
      mintParams.map((x) => x.acc),
      mintParams.map((x) => x.tokenId),
      mintParams.map((x) => x.amount)
    );

    for (const { acc, tokenId, amount } of mintParams) {
      const balance = await contract.balanceOf(acc, BigNumber.from(tokenId));
      expect(balance.toNumber()).to.be.equal(amount);
    }
  });

  it('setApprovalForAll should throw', async () => {
    await expect(contract.setApprovalForAll(signers[0].address, true)).to.be.revertedWith('SBT');
  });

  it('safeTransferFrom should throw', async () => {
    await expect(contract.safeTransferFrom(signers[0].address, signers[1].address, 1, 1, '0x')).to.be.revertedWith(
      'SBT'
    );
  });

  it('safeBatchTransferFrom should throw', async () => {
    await expect(
      contract.safeBatchTransferFrom(signers[0].address, signers[1].address, [1, 2], [1, 1], '0x')
    ).to.be.revertedWith('SBT');
  });
});
