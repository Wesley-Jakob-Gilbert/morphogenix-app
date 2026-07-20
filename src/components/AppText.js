import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';

import colors from '../theme/colors';
import typography from '../theme/typography';

/**
 * AppText (Round 3 #11)
 *
 * The app-wide default text component. It replaces the old
 * `Text.defaultProps.style` mutation in App.js — that global-mutation pattern
 * is deprecated in React 18 / RN 0.7x (it logs a "Text.defaultProps ... will be
 * removed" warning and is a shared-mutable-state smell). Instead, screens and
 * components import this wrapper, which applies the default Inter Regular face
 * (and the default ink/white text color) BEFORE any caller style, so explicit
 * `fontFamily` / `color` in a caller's StyleSheet still win.
 *
 * Drop-in for react-native's <Text>: it forwards every prop (including `style`,
 * `numberOfLines`, `onPress`, accessibility props) and a ref.
 *
 * Where a component sets its own family in a StyleSheet (e.g. the Inter Black
 * display numerals), that explicit style still overrides the default because it
 * comes AFTER `styles.base` in the array.
 */
const AppText = React.forwardRef(function AppText({ style, ...rest }, ref) {
  return <RNText ref={ref} style={[styles.base, style]} {...rest} />;
});

const styles = StyleSheet.create({
  base: {
    // App-wide default face + color. Callers override via their own style.
    fontFamily: typography.family.regular,
    color: colors.white,
  },
});

export default AppText;
