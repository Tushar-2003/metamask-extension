import { ObservableStore } from '@metamask/obs-store';

import fetchWithCache from '../../../shared/lib/fetch-with-cache';

/**
 * @typedef {object} SymbolToMatchControllerInitState
 * @property {object} nativeSymbolToMatch - An object of chainId to native symbol
 * chainId is used as a key to get the native symbol
 * @property {object} tokensSymbolToMatch - An object of chainId to tokens symbol
 * chainId is used as a key to get the tokens symbol
 */

/**
 * @typedef {object} SymbolToMatchControllerOptions
 * @property {SymbolToMatchControllerInitState} initState - The initial controller state
 */

const findMatchedSymbol = async (chainId) => {
  const safeChainsList = await fetchWithCache({
    url: 'https://chainid.network/chains.json',
    functionName: 'getSafeChainsList',
  });

  const matchedChain = safeChainsList.find(
    (network) => network.chainId === parseInt(chainId, 16),
  );

  return matchedChain?.nativeCurrency?.symbol ?? null;
};

/**
 * Controller responsible for storing symbol on the state.
 */
export default class SymbolToMatchController {
  /**
   * @param {SymbolToMatchController} [opts] - Controller configuration parameters
   */
  constructor(opts = {}) {
    const {
      initState = {},
      messenger,
      network,
      preferencesStore,
      symbol,
      tokens,
      assetsContractController,
    } = opts;

    const state = {
      symbolToMatch: {
        ...initState.symbolToMatch,
        nativeSymbolToMatch: {},
        tokensSymbolToMatch: {},
      },
    };

    this.store = new ObservableStore(state);

    this.network = network;

    this.selectedAddress = preferencesStore.getState().selectedAddress;

    this.assetsContractController = assetsContractController;
    this.chainId = this.getChainIdFromNetworkStore();

    messenger.subscribe('NetworkController:stateChange', () => {
      if (this.chainId !== this.getChainIdFromNetworkStore()) {
        const chainId = this.getChainIdFromNetworkStore();
        this.chainId = chainId;

        this.setSymbolToMatch(this.chainId, symbol);
        this.setSymbolTokensToMatch(tokens, this.chainId);
      }
    });
    this.setSymbolToMatch(this.chainId, symbol);
    this.setSymbolTokensToMatch(tokens, this.chainId);
  }

  setSymbolToMatch(chainId) {
    findMatchedSymbol(chainId).then((nativeSymbol) => {
      let { symbolToMatch } = this.store.getState();
      symbolToMatch = { ...symbolToMatch };
      symbolToMatch.nativeSymbolToMatch[chainId] = nativeSymbol;

      this.store.updateState({
        symbolToMatch,
      });
    });
  }

  setSymbolTokensToMatch(tokens, chainId) {
    let { symbolToMatch } = this.store.getState();
    symbolToMatch = { ...symbolToMatch };

    tokens.forEach((token) => {
      this.assetsContractController
        .getTokenStandardAndDetails(token.address)
        .then((result) => {
          const symbolTokenToMatch = result?.symbol ?? null;
          symbolToMatch.tokensSymbolToMatch[chainId] = {
            ...symbolToMatch.tokensSymbolToMatch[chainId],
            [token.address]: symbolTokenToMatch,
          };
          this.store.updateState({ symbolToMatch });
        });
    });
  }

  getChainIdFromNetworkStore() {
    return this.network?.state.providerConfig.chainId;
  }
}
