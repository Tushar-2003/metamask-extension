/* eslint-disable */

import nock from 'nock';
import { ControllerMessenger } from '@metamask/base-controller';
import { NetworkController } from '@metamask/network-controller';
import {
  AssetsContractController,
  TokenListController,
} from '@metamask/assets-controllers';
import { toHex } from '@metamask/controller-utils';
import PreferencesController from './preferences';
import SymbolToMatchController from './symbol-to-match';
import {
  CHAIN_IDS,
  NETWORK_TYPES,
  TEST_NETWORK_TICKER_MAP,
} from '../../../shared/constants/network';

describe('SymbolToMatchController', () => {
  let assetsContractController,
    network,
    preferences,
    provider,
    tokenListController,
    initialNetworkControllerState,
    messenger;

  const noop = () => undefined;

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const getRestrictedMessenger = () => {
    return messenger.getRestricted({
      name: 'SymbolToMatchController',
      allowedActions: ['KeyringController:getState'],
      allowedEvents: [
        'NetworkController:stateChange',
        'KeyringController:lock',
        'KeyringController:unlock',
      ],
    });
  };

  const networkControllerProviderConfig = {
    getAccounts: noop,
  };

  const infuraProjectId = 'infura-project-id';

  beforeEach(async function () {
    nock.disableNetConnect();

    nock('https://mainnet.infura.io')
      .post(`/v3/${infuraProjectId}`)
      .reply(200, (_uri, requestBody) => {
        if (requestBody.method === 'eth_getBlockByNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: {
              number: '0x42',
            },
          };
        }

        if (requestBody.method === 'eth_call') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result:
              '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000',
          };
        }

        if (requestBody.method === 'eth_blockNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: '0x42',
          };
        }

        throw new Error(`(Infura) Mock not defined for ${requestBody.method}`);
      })
      .persist();
    nock('https://sepolia.infura.io')
      .post(`/v3/${infuraProjectId}`)
      .reply(200, (_uri, requestBody) => {
        if (requestBody.method === 'eth_getBlockByNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: {
              number: '0x42',
            },
          };
        }

        if (requestBody.method === 'eth_call') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result:
              '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000',
          };
        }

        if (requestBody.method === 'eth_blockNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: '0x42',
          };
        }

        throw new Error(`(Infura) Mock not defined for ${requestBody.method}`);
      })
      .persist();
    nock('http://localhost:8545')
      .post('/')
      .reply(200, (_uri, requestBody) => {
        if (requestBody.method === 'eth_getBlockByNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: {
              number: '0x42',
            },
          };
        }

        if (requestBody.method === 'eth_blockNumber') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: '0x42',
          };
        }

        if (requestBody.method === 'eth_call') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result:
              '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000',
          };
        }

        if (requestBody.method === 'net_version') {
          return {
            id: requestBody.id,
            jsonrpc: '2.0',
            result: '1337',
          };
        }

        throw new Error(
          `(localhost) Mock not defined for ${requestBody.method}`,
        );
      })
      .persist();

    messenger = new ControllerMessenger();
    messenger.registerActionHandler('KeyringController:getState', () => ({
      isUnlocked: true,
    }));

    initialNetworkControllerState = {
      providerConfig: {
        type: NETWORK_TYPES.MAINNET,
        chainId: CHAIN_IDS.MAINNET,
        ticker: TEST_NETWORK_TICKER_MAP[NETWORK_TYPES.MAINNET],
      },
    };

    const networkControllerMessenger = new ControllerMessenger();
    network = new NetworkController({
      messenger: networkControllerMessenger,
      state: initialNetworkControllerState,
      infuraProjectId,
    });
    await network.initializeProvider(networkControllerProviderConfig);
    provider = network.getProviderAndBlockTracker().provider;

    const tokenListMessenger = new ControllerMessenger().getRestricted({
      name: 'TokenListController',
      allowedEvents: ['TokenListController:stateChange'],
    });
    tokenListController = new TokenListController({
      chainId: toHex(1),
      preventPollingOnNetworkRestart: false,
      onNetworkStateChange: jest.fn(),
      onPreferencesStateChange: jest.fn(),
      messenger: tokenListMessenger,
    });
    await tokenListController.start();

    preferences = new PreferencesController({
      network,
      provider,
      tokenListController,
      networkConfigurations: {},
      onAccountRemoved: jest.fn(),
    });
    preferences.setAddresses([
      '0x7e57e2',
      '0xbc86727e770de68b1060c91f6bb6945c73e10388',
    ]);
    preferences.setUseTokenDetection(true);

    assetsContractController = new AssetsContractController(
      {
        onPreferencesStateChange: preferences.store.subscribe.bind(
          preferences.store,
        ),
        onNetworkStateChange: networkControllerMessenger.subscribe.bind(
          networkControllerMessenger,
          'NetworkController:stateChange',
        ),
      },
      {
        provider,
      },
    );
  });

  afterEach(function () {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should set symbolToMatch on the state', async () => {
    nock('https://chainid.network:443', { encodedQueryParams: true })
      .get('/chains.json')
      .reply(200, [
        {
          name: 'Ethereum Mainnet',
          chain: 'ETH',
          rpc: ['https://mainnet.infura.io/v3/'],
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          shortName: 'ETH',
          chainId: 1,
        },
      ]);
    const symbolToMatchController = new SymbolToMatchController({
      messenger: getRestrictedMessenger(),
      network,
      preferencesStore: preferences.store,
      assetsContractController,
      symbol: 'ETH',
      tokens: [],
    });

    // wait for 1 second
    await delay(1000);

    const state = symbolToMatchController.store.getState();
    expect(state.symbolToMatch.nativeSymbolToMatch).toStrictEqual({
      '0x1': 'ETH',
    });
  });

  it('should set symbolToMatch to null on the state for unknown network', async () => {
    nock('https://chainid.network:443', { encodedQueryParams: true })
      .get('/chains.json')
      .reply(200, [
        {
          name: 'Ethereum Mainnet',
          chain: 'ETH',
          rpc: ['https://mainnet.infura.io/v3/'],
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          shortName: 'ETH',
          chainId: 1,
        },
      ]);

    const otherNetworkControllerState = {
      providerConfig: {
        type: NETWORK_TYPES.GOERLI,
        chainId: CHAIN_IDS.GOERLI,
        ticker: TEST_NETWORK_TICKER_MAP[NETWORK_TYPES.GOERLI],
      },
    };

    const networkControllerMessenger = new ControllerMessenger();
    const otherNetwork = new NetworkController({
      messenger: networkControllerMessenger,
      state: otherNetworkControllerState,
      infuraProjectId,
    });
    const symbolToMatchController = new SymbolToMatchController({
      messenger: getRestrictedMessenger(),
      network: otherNetwork,
      preferencesStore: preferences.store,
      assetsContractController,
      symbol: 'TEST',
      tokens: [],
    });

    // wait for 1 second
    await delay(1000);

    const state = symbolToMatchController.store.getState();

    expect(state.symbolToMatch.nativeSymbolToMatch).toStrictEqual({
      '0x5': null,
    });
  });

  it('should set symbolTokensToMatch on the state', async () => {
    nock('https://chainid.network:443', { encodedQueryParams: true })
      .get('/chains.json')
      .reply(200, [
        {
          name: 'Ethereum Mainnet',
          chain: 'ETH',
          rpc: ['https://mainnet.infura.io/v3/'],
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          shortName: 'ETH',
          chainId: 1,
        },
      ]);

    const symbolToMatchController = new SymbolToMatchController({
      messenger: getRestrictedMessenger(),
      network,
      preferencesStore: preferences.store,
      assetsContractController,
      symbol: 'ETH',
      tokens: [
        {
          address: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0',
        },
      ],
    });
    // wait for 1 second
    await delay(1000);

    const state = symbolToMatchController.store.getState();

    expect(state.symbolToMatch.tokensSymbolToMatch).toStrictEqual({
      '0x1': {
        '0x3845badAde8e6dFF049820680d1F14bD3903a5d0': 'USDC',
      },
    });
  });
});
