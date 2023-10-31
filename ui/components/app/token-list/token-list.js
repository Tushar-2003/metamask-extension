import React, { useEffect, useReducer } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { produce } from 'immer';
import TokenCell from '../token-cell';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { Box } from '../../component-library';
import {
  AlignItems,
  Display,
  JustifyContent,
} from '../../../helpers/constants/design-system';
import { getCurrentChainId, getOriginalTokensSymbol } from '../../../selectors';

const symbolToMatchReducer = produce((state, action) => {
  switch (action.type) {
    case 'SET_SYMBOL_TOKENS_TO_MATCH':
      return action.value;
    default:
      return state;
  }
});

export default function TokenList({ onTokenClick, tokens, loading = false }) {
  const t = useI18nContext();
  const chainId = useSelector(getCurrentChainId);
  const tokensSymbol = useSelector(getOriginalTokensSymbol);

  const [symbolToMatch, dispatch] = useReducer(symbolToMatchReducer, {});

  useEffect(() => {
    tokens.forEach((token) => {
      if (
        token.symbol &&
        !symbolToMatch?.[chainId] &&
        !symbolToMatch?.[chainId]?.[token.address]
      ) {
        dispatch({
          type: 'SET_SYMBOL_TOKENS_TO_MATCH',
          value: { [chainId]: { [token.address]: token.symbol } },
        });
      }
    });
  }, [tokensSymbol, chainId, dispatch, symbolToMatch, tokens]);

  if (loading) {
    return (
      <Box
        display={Display.Flex}
        alignItems={AlignItems.center}
        justifyContent={JustifyContent.center}
        padding={7}
        data-testid="token-list-loading-message"
      >
        {t('loadingTokens')}
      </Box>
    );
  }

  return (
    <div>
      {tokens.map((tokenData, index) => (
        <TokenCell key={index} {...tokenData} onClick={onTokenClick} />
      ))}
    </div>
  );
}

TokenList.propTypes = {
  onTokenClick: PropTypes.func.isRequired,
  tokens: PropTypes.array.isRequired,
  loading: PropTypes.bool,
};
