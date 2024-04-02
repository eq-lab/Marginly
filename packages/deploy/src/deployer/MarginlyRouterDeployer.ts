import { EthAddress } from '@marginly/common';
import { BigNumber, Signer } from 'ethers';
import { StateStore, readMarginlyAdapterContract, readMarginlyRouterContract } from '../common';
import { ITokenRepository, DeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';
import { MarginlyAdapterParam } from './configs';
import { EthOptions } from '../config';
import { Logger } from '../logger';

export class MarginlyRouterDeployer extends BaseDeployer {
  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
  }

  public async deployMarginlyAdapter(
    tokenRepository: ITokenRepository,
    dexId: BigNumber,
    adapterName: string,
    pools: MarginlyAdapterParam[],
    balancerVault?: EthAddress
  ): Promise<DeployResult> {
    const args: any[] = [
      pools.map((x) => [
        tokenRepository.getTokenInfo(x.token0.id).address.toString(),
        tokenRepository.getTokenInfo(x.token1.id).address.toString(),
        x.pool.toString(),
      ]),
    ];
    if (balancerVault !== undefined) {
      args.push(balancerVault.toString());
    }

    return this.deploy(adapterName, args, `${adapterName}_${dexId}`, readMarginlyAdapterContract);
  }

  public async deployMarginlyRouter(adapters: { dexId: BigNumber; adapter: EthAddress }[]): Promise<DeployResult> {
    const args = [adapters.map((x) => [x.dexId.toNumber(), x.adapter.toString()])];
    const deployResult = await this.deploy('MarginlyRouter', args, 'MarginlyRouter', readMarginlyRouterContract);

    const adaptersToAdd = [];
    const router = deployResult.contract;
    for (const adapter of adapters) {
      const routerAdapter = await router.adapters(adapter.dexId);
      if (routerAdapter.toString().toLowerCase() !== adapter.adapter.toString().toLowerCase()) {
        adaptersToAdd.push(adapter);

        this.logger.log(`Adapter dexId:${adapter.dexId} address:${adapter.adapter} should be added to MarginlyRouter`);
      }
    }

    if (adaptersToAdd.length > 0) {
      const adaptersToAddArgs = adaptersToAdd.map((x) => [x.dexId.toNumber(), x.adapter.toString()]);
      await router.connect(this.signer).addDexAdapters(adaptersToAddArgs);

      this.logger.log(`Added ${adaptersToAdd.length} adapters to MarginlyRouter`);
    }

    return deployResult;
  }
}