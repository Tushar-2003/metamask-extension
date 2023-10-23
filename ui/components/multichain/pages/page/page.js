import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Box } from '../../../component-library';
import {
  BackgroundColor,
  BlockSize,
  Display,
  FlexDirection,
  JustifyContent,
} from '../../../../helpers/constants/design-system';

export const Page = ({
  header = null,
  footer = null,
  children,
  className = '',
  ...props
}) => {
  return (
    <Box
      width={BlockSize.Full}
      height={BlockSize.Full}
      display={Display.Flex}
      flexDirection={FlexDirection.Row}
      justifyContent={JustifyContent.center}
      backgroundColor={BackgroundColor.backgroundAlternative}
      className="multichain-page"
    >
      <Box
        width={BlockSize.Full}
        height={BlockSize.Full}
        display={Display.Flex}
        flexDirection={FlexDirection.Column}
        backgroundColor={BackgroundColor.backgroundDefault}
        className={classnames('multichain-page__inner-container', className)}
        {...props}
      >
        {header}
        {children}
        {footer}
      </Box>
    </Box>
  );
};

Page.propTypes = {
  header: PropTypes.element,
  footer: PropTypes.element,
  className: PropTypes.string,
  children: PropTypes.node,
};
