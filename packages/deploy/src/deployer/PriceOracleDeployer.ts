import { EthAddress } from '@marginly/common';
import { UniswapV3TickDoubleOracleConfig, UniswapV3TickOracleConfig } from './configs';
import { DeployResult, ITokenRepository } from '../common/interfaces';
import { BigNumber, Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { createMarginlyPeripheryOracleReader } from './contract-reader';
import { BaseDeployer } from './BaseDeployer';

type OracleParams = {
  initialized: boolean;
  secondsAgo: BigNumber;
  secondsAgoLiquidation: BigNumber;
  uniswapFee: BigNumber;
};

type OracleDoubleParams = {
  initialized: boolean;
  secondsAgo: BigNumber;
  secondsAgoLiquidation: BigNumber;
  baseTokenPairFee: BigNumber;
  quoteTokenPairFee: BigNumber;
  intermediateToken: string;
};

export class PriceOracleDeployer extends BaseDeployer {
  private readonly readMarginlyPeripheryOracleContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readMarginlyPeripheryOracleContract = createMarginlyPeripheryOracleReader();
  }

  public async deployAndConfigureUniswapV3TickOracle(
    config: UniswapV3TickOracleConfig,
    uniswapV3Factory: EthAddress,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracle',
      [uniswapV3Factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();
      const uniswapFee = this.toUniswapFee(setting.uniswapFee);

      const currentParams: OracleParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());
      if (
        !currentParams.initialized ||
        !currentParams.secondsAgo.eq(secondsAgo) ||
        !currentParams.secondsAgoLiquidation.eq(secondsAgoLiquidation) ||
        !currentParams.uniswapFee.eq(uniswapFee)
      ) {
        this.logger.log(`Set oracle ${config.id} options`);

        await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          uniswapFee
        );
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }

  public async deployAndConfigureUniswapV3TickDoubleOracle(
    config: UniswapV3TickDoubleOracleConfig,
    uniswapV3Factory: EthAddress,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracleDouble',
      [uniswapV3Factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();
      const baseTokenPairFee = this.toUniswapFee(setting.baseTokenPairFee);
      const quoteTokenPairFee = this.toUniswapFee(setting.quoteTokenPairFee);

      const currentParams: OracleDoubleParams = await priceOracle.getParamsEncoded(
        quoteToken.toString(),
        baseToken.toString()
      );

      if (
        !currentParams.initialized ||
        !currentParams.secondsAgo.eq(secondsAgo) ||
        !currentParams.secondsAgoLiquidation.eq(secondsAgoLiquidation) ||
        !currentParams.baseTokenPairFee.eq(baseTokenPairFee) ||
        !currentParams.quoteTokenPairFee.eq(quoteTokenPairFee) ||
        currentParams.intermediateToken.toLowerCase() !== intermediateToken.toString().toLowerCase()
      ) {
        this.logger.log(`Set oracle ${config.id} options`);
        await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          baseTokenPairFee,
          quoteTokenPairFee,
          intermediateToken.toString()
        );
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }
}
