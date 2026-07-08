import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text as RNText } from 'react-native';

import AppText from '../AppText';
import typography from '../../theme/typography';
import colors from '../../theme/colors';

// Round 3 #11 — AppText replaces the removed Text.defaultProps mutation. It must
// apply the default Inter Regular face + ink color BEFORE caller styles, and
// forward children / props to a real RN Text.

function firstTextStyle(tree) {
  const t = tree.root.findAllByType(RNText)[0];
  const s = t.props.style;
  return Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s;
}

describe('AppText', () => {
  it('renders its children through a real RN Text', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<AppText>hello</AppText>);
    });
    const t = tree.root.findAllByType(RNText)[0];
    expect(t.props.children).toBe('hello');
    act(() => tree.unmount());
  });

  it('applies the default Inter Regular face and ink color', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<AppText>x</AppText>);
    });
    const flat = firstTextStyle(tree);
    expect(flat.fontFamily).toBe(typography.family.regular);
    expect(flat.color).toBe(colors.white);
    act(() => tree.unmount());
  });

  it('lets a caller style override the default face (caller wins)', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <AppText style={{ fontFamily: typography.familyDisplay, color: colors.teal }}>
          9
        </AppText>
      );
    });
    const flat = firstTextStyle(tree);
    // The base is applied first, the caller style second -> caller wins.
    expect(flat.fontFamily).toBe(typography.familyDisplay);
    expect(flat.color).toBe(colors.teal);
    act(() => tree.unmount());
  });

  it('forwards arbitrary props (e.g. numberOfLines)', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<AppText numberOfLines={2}>y</AppText>);
    });
    const t = tree.root.findAllByType(RNText)[0];
    expect(t.props.numberOfLines).toBe(2);
    act(() => tree.unmount());
  });
});
