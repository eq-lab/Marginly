import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  createCurveEMAOracleBackward,
  createCurveEMAOracleForward,
  createCurveEMAOracleWithoutAddingPool,
} from './shared/fixtures';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';

const X96One = 1n << 96n;

function assertOracleParamsIsEmpty(oracleParams: {
  pool: string;
  isForwardOrder: boolean;
  baseDecimals: number;
  quoteDecimals: number;
}) {
  expect(oracleParams.pool).to.be.equal(constants.AddressZero);
  expect(oracleParams.baseDecimals).to.be.equal(0);
  expect(oracleParams.quoteDecimals).to.be.equal(0);
  expect(oracleParams.isForwardOrder).to.be.equal(false);
}

function assertOracleParamsIsFilled(
  oracleParams: {
    pool: string;
    isForwardOrder: boolean;
    baseDecimals: number;
    quoteDecimals: number;
  },
  actualPool: string,
  isForwardOrder: boolean,
  baseDecimals: number,
  quoteDecimals: number
) {
  expect(oracleParams.pool).to.be.equal(actualPool);
  expect(oracleParams.baseDecimals).to.be.equal(baseDecimals);
  expect(oracleParams.quoteDecimals).to.be.equal(quoteDecimals);
  expect(oracleParams.isForwardOrder).to.be.equal(isForwardOrder);
}

describe('CurveEMAPriceOracle', () => {
  it('forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleForward);

    const quoteDecimals = await quoteToken.decimals();
    const baseDecimals = await baseToken.decimals();

    const params = await oracle.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsFilled(params, pool.address, true, baseDecimals, quoteDecimals);

    const priceFromPool = await pool.price_oracle();

    const balancePriceX96 = await oracle.getBalancePrice(quoteToken.address, baseToken.address);
    const margincallPriceX96 = await oracle.getMargincallPrice(quoteToken.address, baseToken.address);

    const decimalsMultiplier = BigNumber.from(10).pow(18 + baseDecimals - quoteDecimals);
    const expectedBalancePriceX96 = priceFromPool.mul(X96One).div(decimalsMultiplier);
    const expectedMargincallPriceX96 = expectedBalancePriceX96;

    expect(balancePriceX96).to.be.equal(expectedBalancePriceX96);
    expect(margincallPriceX96).to.be.equal(expectedMargincallPriceX96);
  });

  it('backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleBackward);

    const quoteDecimals = await quoteToken.decimals();
    const baseDecimals = await baseToken.decimals();

    const params = await oracle.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsFilled(params, pool.address, false, baseDecimals, quoteDecimals);

    let priceFromPool = await pool.price_oracle();

    const balancePriceX96 = await oracle.getBalancePrice(quoteToken.address, baseToken.address);
    const margincallPriceX96 = await oracle.getMargincallPrice(quoteToken.address, baseToken.address);

    const decimalsMultiplier = BigNumber.from(10).pow(18 + quoteDecimals - baseDecimals);
    const expectedBalancePriceX96 = BigNumber.from(X96One).mul(decimalsMultiplier).div(priceFromPool);
    const expectedMargincallPriceX96 = expectedBalancePriceX96;

    expect(balancePriceX96).to.be.equal(expectedBalancePriceX96);
    expect(margincallPriceX96).to.be.equal(expectedMargincallPriceX96);
  });

  it('zero price', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleBackward);
    await pool.setPrices(0, 0, 0);

    await expect(oracle.getBalancePrice(quoteToken.address, baseToken.address)).to.be.revertedWithCustomError(
      oracle,
      'ZeroPrice'
    );
    await expect(oracle.getMargincallPrice(quoteToken.address, baseToken.address)).to.be.revertedWithCustomError(
      oracle,
      'ZeroPrice'
    );
  });

  it('add pool rights', async () => {
    const [, user] = await ethers.getSigners();
    const {
      oracle: oracleOwnerConnected,
      pool,
      quoteToken,
      baseToken,
    } = await loadFixture(createCurveEMAOracleWithoutAddingPool);

    const quoteDecimals = await quoteToken.decimals();
    const baseDecimals = await baseToken.decimals();

    const paramsBefore = await oracleOwnerConnected.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsEmpty(paramsBefore);

    const oracleUserConnected = oracleOwnerConnected.connect(user);
    await expect(oracleUserConnected.addPool(pool.address, quoteToken.address, baseToken.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await oracleOwnerConnected.addPool(pool.address, quoteToken.address, baseToken.address);
    const paramsAfter = await oracleOwnerConnected.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsFilled(paramsAfter, pool.address, false, baseDecimals, quoteDecimals);
  });

  it('add pool invalid', async () => {
    const { oracle, pool, quoteToken, baseToken, anotherToken } = await loadFixture(
      createCurveEMAOracleWithoutAddingPool
    );

    await expect(
      oracle.addPool(constants.AddressZero, baseToken.address, quoteToken.address)
    ).to.be.revertedWithCustomError(oracle, 'ZeroAddress');
    await expect(oracle.addPool(pool.address, constants.AddressZero, quoteToken.address)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken.address, constants.AddressZero)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken.address, baseToken.address)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken.address, anotherToken.address)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
    await expect(oracle.addPool(pool.address, anotherToken.address, quoteToken.address)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
  });

  it('remove pool rights', async () => {
    const [, user] = await ethers.getSigners();
    const {
      oracle: oracleOwnerConnected,
      pool,
      quoteToken,
      baseToken,
    } = await loadFixture(createCurveEMAOracleBackward);

    const quoteDecimals = await quoteToken.decimals();
    const baseDecimals = await baseToken.decimals();

    const paramsBefore = await oracleOwnerConnected.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsFilled(paramsBefore, pool.address, false, baseDecimals, quoteDecimals);

    const oracleUserConnected = oracleOwnerConnected.connect(user);
    await expect(oracleUserConnected.removePool(quoteToken.address, baseToken.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await oracleOwnerConnected.removePool(quoteToken.address, baseToken.address);
    const paramsAfter = await oracleOwnerConnected.getParams(quoteToken.address, baseToken.address);
    assertOracleParamsIsEmpty(paramsAfter);
  });
});