import { renderHook } from '@testing-library/react-hooks';
import { useSelector } from 'react-redux';
import {
  getCurrentChainId,
  getCurrentCurrency,
  getOriginalTokensSymbol,
  getShouldShowFiat,
  getTokenExchangeRates,
} from '../selectors';
import { getConversionRate } from '../ducks/metamask/metamask';
import * as utils from '../helpers/utils/token-util';
import { useTokenFiatAmount } from './useTokenFiatAmount';

const tests = [
  {
    token: {
      address: '0xtest',
      symbol: 'DAI',
      decimals: 18,
    },
    tokenData: {
      args: 'decoded-params1',
    },
    tokenValue: '1000000000000000000',
    displayValue: '1',
    amount: '23',
  },
  {
    token: {
      address: '0xtest2',
      symbol: 'DAI',
      decimals: 18,
    },
    tokenData: {
      args: 'decoded-params1',
    },
    tokenValue: '1000000000000000000',
    displayValue: undefined,
    amount: '23',
  },
];

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');

  return {
    ...actual,
    useSelector: jest.fn(),
    useDispatch: jest.fn(),
  };
});

const generateUseSelectorRouter = () => (selector) => {
  if (selector === getTokenExchangeRates) {
    return { '0x3845badAde8e6dFF049820680d1F14bD3903a5d0': 0.00019148 };
  } else if (selector === getConversionRate) {
    return 1799.62;
  } else if (selector === getCurrentCurrency) {
    return 'usd';
  } else if (selector === getShouldShowFiat) {
    return true;
  } else if (selector === getOriginalTokensSymbol) {
    return {
      '0x1': {
        '0xtest': 'DAI',
      },
    };
  } else if (selector === getCurrentChainId) {
    return '0x1';
  }
  return null;
};

describe('useTokenFiatAmount', () => {
  beforeAll(() => {
    useSelector.mockImplementation(generateUseSelectorRouter());
  });

  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  tests.forEach(({ displayValue, token, amount }) => {
    describe(`when input is symbol: ${token.symbol}`, () => {
      it(`should return ${displayValue} as displayValue`, () => {
        jest.spyOn(utils, 'getTokenFiatAmount').mockReturnValue(displayValue);
        const { result } = renderHook(() =>
          useTokenFiatAmount(token.address, amount, token.symbol, {}, false),
        );
        expect(result.current).toStrictEqual(displayValue);
      });
    });
  });
});
