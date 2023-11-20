import { Command, Option } from 'commander';
import { sleep, ContractDescription } from '@marginly/common';
import {
  createSystemContext,
  getCommanderForm,
  Parameter,
  readEthSignerFromContext,
  readParameter,
  SystemContext,
  ethKeyTypeParameter,
  ethKeyFileParameter,
  ethKeyPasswordParameter,
} from '@marginly/cli-common';
import { createRootLogger, jsonFormatter, LogFormatter, textFormatter } from '@marginly/logger';
import { stdOutWriter } from '@marginly/logger-node';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { MarginlyKeeperWorker } from './MarginlyKeeperWorker';
import { createPoolWatchers } from './PoolWatcher';
import { ContractDescriptions, KeeperArgs, KeeperConfig, KeeperParamter } from './types';

function createLogFormatter(format: string): LogFormatter {
  if (format == 'text') {
    return textFormatter;
  } else if (format == 'json') {
    return jsonFormatter;
  } else {
    throw new Error(`Configuration error, log format "${format}" not supported`);
  }
}

async function readReadOnlyEthFromContext(
  systemContext: SystemContext
): Promise<{ nodeUri: { parameter: Parameter; value: string } }> {
  const nodeUri = readParameter(nodeUriParameter, systemContext);

  if (!nodeUri) {
    throw new Error('Unable to determine Eth Node Uri');
  }

  return {
    nodeUri: {
      parameter: nodeUriParameter,
      value: nodeUri,
    },
  };
}

async function createSignerFromContext(systemContext: SystemContext): Promise<ethers.Signer> {
  const nodeUri = await readReadOnlyEthFromContext(systemContext);

  const provider = new ethers.providers.JsonRpcProvider(nodeUri.nodeUri.value);
  const signer = (await readEthSignerFromContext(systemContext)).connect(provider);

  return signer;
}

function createMarginlyContractDescription(name: string): ContractDescription {
  return require(`@marginly/contracts/artifacts/contracts/${name}.sol/${name}.json`);
}

function createOpenZeppelinContractDescription(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

function prepareContractDescriptions(): ContractDescriptions {
  return {
    token: createOpenZeppelinContractDescription('IERC20Metadata'),
    keeper: createMarginlyContractDescription('MarginlyKeeper'),
    marginlyPool: createMarginlyContractDescription('MarginlyPool'),
  };
}

const ENV_PREFIX: string = 'MARGINLY_KEEPER';

const configParameter: KeeperParamter = {
  name: ['config'],
  description: 'Path to config file',
  default: 'raw',
  env: `${ENV_PREFIX}_CONFIG`,
};

const logFormatParamter: KeeperParamter = {
  name: ['log', 'format'],
  description: "Log format 'text' or 'json'",
  default: 'json',
  env: `${ENV_PREFIX}_LOG_FORMAT`,
};

const logLevelParamter: KeeperParamter = {
  name: ['log', 'level'],
  description: 'Log level: 1-Verbose,2-Debug,3-Information,4-Warning,5-Error,6-Fatal',
  default: 'json',
  env: `${ENV_PREFIX}_LOG_LEVEL`,
};

const nodeUriParameter: KeeperParamter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
  env: `${ENV_PREFIX}_ETH_NODE_URI`,
};

const ethKeyParameter: KeeperParamter = {
  name: ['eth', 'key'],
  description: 'Signer private key',
  env: `${ENV_PREFIX}_ETH_KEY`,
};

const createCommanderOption = (parameter: KeeperParamter): Option => {
  let option = new Option(getCommanderForm(parameter), parameter.description).env(parameter.env!);
  if (parameter.default) {
    option = option.default(parameter.default);
  }

  return option;
};

const watchMarginlyPoolsCommand = new Command()
  .addOption(createCommanderOption(configParameter))
  .addOption(createCommanderOption(logFormatParamter))
  .addOption(createCommanderOption(logLevelParamter))
  .addOption(createCommanderOption(nodeUriParameter))
  .option(getCommanderForm(ethKeyTypeParameter), ethKeyTypeParameter.description)
  .addOption(createCommanderOption(ethKeyParameter))
  .option(getCommanderForm(ethKeyFileParameter), ethKeyFileParameter.description)
  .option(getCommanderForm(ethKeyPasswordParameter), ethKeyPasswordParameter.description)
  .action(async (commandArgs: KeeperArgs, command: Command) => {
    const config: KeeperConfig = JSON.parse(fs.readFileSync(commandArgs.config, 'utf-8'));
    const systemContext = createSystemContext(command, config.systemContextDefaults);

    const logger = createRootLogger(
      'marginlyKeeper',
      stdOutWriter(createLogFormatter(commandArgs.logFormat)),
      commandArgs.logLevel
    );

    let keeperWorker: MarginlyKeeperWorker | undefined;
    process.on('SIGTERM', () => {
      logger.info('On sigterm');
      keeperWorker?.requestStop();
    });

    process.on('SIGINT', () => {
      logger.info('On sigint');
      keeperWorker?.requestStop();
    });
    logger.info(`Service started with config:"${commandArgs.config}", log-level: ${commandArgs.logLevel}`);

    const signer = await createSignerFromContext(systemContext);
    const contractDescriptions = prepareContractDescriptions();
    const keeperContract = new ethers.Contract(
      config.marginlyKeeperAddress,
      contractDescriptions.keeper.abi,
      signer.provider
    );

    const poolWatchers = await createPoolWatchers(
      logger,
      config,
      contractDescriptions.token,
      contractDescriptions.marginlyPool,
      signer.provider
    );

    keeperWorker = new MarginlyKeeperWorker(
      signer,
      contractDescriptions,
      poolWatchers,
      keeperContract,
      config.connection.ethOptions,
      logger
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await keeperWorker.run();
      if (keeperWorker.isStopRequested()) {
        break;
      }

      await sleep(3000);
    }
  });

const main = async () => {
  await watchMarginlyPoolsCommand.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
