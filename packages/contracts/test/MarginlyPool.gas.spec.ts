import { createMarginlyPool, getInitializedPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { BigNumber } from 'ethers';
import { CallType, toHumanString, ZERO_ADDRESS } from './shared/utils';
import { expect } from 'chai';

describe.skip('Open position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const depositAmount = 1000;

    await snapshotGasCost(
      await marginlyPool.connect(signer).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    );
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const depositAmount = 1000;

    await snapshotGasCost(
      await marginlyPool.connect(signer).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    );
  });
});

describe.skip('Deposit into existing position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool.connect(signer1).execute(CallType.DepositBase, firstDeposit, 0, false, ZERO_ADDRESS);
    await snapshotGasCost(
      marginlyPool.connect(signer1).execute(CallType.DepositBase, secondDeposit, 0, false, ZERO_ADDRESS)
    );
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool.connect(signer1).execute(CallType.DepositQuote, firstDeposit, 0, false, ZERO_ADDRESS);
    await snapshotGasCost(
      marginlyPool.connect(signer1).execute(CallType.DepositQuote, secondDeposit, 0, false, ZERO_ADDRESS)
    );
  });
});

describe.skip('System initialized:', async () => {
  it('long', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const longer = wallets[0];
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await snapshotGasCost(marginlyPool.connect(longer).execute(CallType.Long, 900, 0, false, ZERO_ADDRESS));
  });

  it('short', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const shorter = wallets[0];
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 3000, 0, false, ZERO_ADDRESS);
    await snapshotGasCost(marginlyPool.connect(shorter).execute(CallType.Short, 400, 0, false, ZERO_ADDRESS));
  });

  it('depositBase', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).execute(CallType.DepositBase, 100, 0, false, ZERO_ADDRESS));
  });

  it('depositBase and long', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).execute(CallType.DepositBase, 100, 150, false, ZERO_ADDRESS));
  });

  it('depositQuote', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).execute(CallType.DepositQuote, 3000, 0, false, ZERO_ADDRESS));
  });

  it('depositQuote and short', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).execute(CallType.DepositQuote, 3000, 1000, false, ZERO_ADDRESS));
  });

  it('closePosition', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const borrower = signers[signers.length - 1];
    await snapshotGasCost(marginlyPool.connect(borrower).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS));
  });

  it('withdrawBase', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const longer = signers[signers.length - 1];
    await snapshotGasCost(marginlyPool.connect(longer).execute(CallType.WithdrawBase, 100, 0, false, ZERO_ADDRESS));
  });

  it('withdrawQuote', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const shorter = signers[11];
    await snapshotGasCost(marginlyPool.connect(shorter).execute(CallType.WithdrawQuote, 100, 0, false, ZERO_ADDRESS));
  });
});

describe.skip('mc happens:', async () => {
  it('depositBase with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositor, lender] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 10 * longAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS)
    );
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositor, lender] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 10 * longAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS)
    );
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('short with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, longer, shorter] = await ethers.getSigners();

    await marginlyPool.connect(depositor).execute(CallType.DepositBase, 100, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 10 * longAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(shorter).execute(CallType.Short, 10, 0, false, ZERO_ADDRESS));
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, longer, lender, shorter] = await ethers.getSigners();
    await marginlyPool.connect(depositor).execute(CallType.DepositQuote, 100, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer).execute(CallType.Long, 10, 0, false, ZERO_ADDRESS));
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long initialized heap with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, lender, longer2] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 3 * longAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, false, ZERO_ADDRESS));
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long closePosition with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, longer, lender, longer2] = await ethers.getSigners();

    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 10 });

    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 3 * longAmount, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, false, ZERO_ADDRESS);

    await time.increase(24 * 60 * 60);

    await snapshotGasCost(
      await marginlyPool.connect(longer2).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS)
    );

    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositBase with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositor] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, Math.floor(20 * longAmount * price), 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS)
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositor] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, shortAmount, 0, false, ZERO_ADDRESS);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, Math.floor(20 * longAmount * price), 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS)
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('short with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, shorter2, lender, depositor] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter2).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, Math.floor(20 * longAmount * price), 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(shorter2).execute(CallType.Short, 10, 0, false, ZERO_ADDRESS));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('long with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, longer2, shorter, lender, depositor] = await ethers.getSigners();
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, Math.floor(20 * longAmount * price), 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, false, ZERO_ADDRESS));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('closePosition with two mc', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, longer, longer2, shorter, lender, depositor] = await ethers.getSigners();
    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 10 });
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 3 * shortAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, Math.floor(20 * longAmount * price), 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(longer2).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS)
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });
});

describe.skip('Liquidation', () => {
  it('liquidate long position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).execute(CallType.DepositBase, baseCollateral, 0, false, ZERO_ADDRESS);

    const longAmount = 1970; // leverage 19.8
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 3000;
    const baseAmount = 0;
    await snapshotGasCost(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, longer.address)
    );
  });

  it('liquidate short position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, shorterCollateral, 0, false, ZERO_ADDRESS);

    const shortAmount = 7500; // leverage 19.9
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 356;
    const baseAmount = 7700; // the sum is enough to cover debt + accruedInterest
    await snapshotGasCost(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    );
  });

  it('liquidate long position and create new long position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).execute(CallType.DepositBase, baseCollateral, 0, false, ZERO_ADDRESS);

    const longAmount = 1970; // leverage 19.8
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 200; // the sum is not enough to cover bad position debt
    const baseAmount = 0;
    await snapshotGasCost(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, longer.address)
    );
  });

  it('liquidate short position and create new short position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, shorterCollateral, 0, false, ZERO_ADDRESS);

    const shortAmount = 7500; // leverage 19.9
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 1000; // the sum is enough to improve position leverage
    const baseAmount = 100; // the sum is not enough to cover debt + accruedInterest
    await snapshotGasCost(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    );
  });
});
