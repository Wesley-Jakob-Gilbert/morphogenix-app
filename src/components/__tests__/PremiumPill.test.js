import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import PremiumPill from '../PremiumPill';
import colors from '../../theme/colors';

// Round 3 #9 — the shared gold PREMIUM chip. Guards the default label, custom
// label override, and that the text uses the single premiumGold token (so the
// mark can't drift back to a hard-coded hex per screen).

function texts(tree) {
  return tree.root
    .findAllByType(Text)
    .map((t) =>
      Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children
    );
}

describe('PremiumPill', () => {
  it('renders the default "PREMIUM FEATURE" label', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<PremiumPill />);
    });
    expect(texts(tree)).toContain('PREMIUM FEATURE');
    act(() => tree.unmount());
  });

  it('renders a custom label when provided', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<PremiumPill label="BETA" />);
    });
    expect(texts(tree)).toContain('BETA');
    act(() => tree.unmount());
  });

  it('colors the label with the premiumGold token', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<PremiumPill />);
    });
    const label = tree.root.findAllByType(Text)[0];
    // Style may be an array or object; flatten to find color.
    const flat = Array.isArray(label.props.style)
      ? Object.assign({}, ...label.props.style)
      : label.props.style;
    expect(flat.color).toBe(colors.premiumGold);
    act(() => tree.unmount());
  });

  it('applies an optional container style override', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<PremiumPill style={{ marginTop: 4 }} />);
    });
    const View = require('react-native').View;
    const container = tree.root.findAllByType(View)[0];
    const flat = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style.filter(Boolean))
      : container.props.style;
    expect(flat.marginTop).toBe(4);
    act(() => tree.unmount());
  });
});
