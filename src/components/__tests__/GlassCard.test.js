import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform, StyleSheet, Text } from 'react-native';

import GlassCard, {
  defaultIntensityForPlatform,
  usesAndroidFallback,
} from '../GlassCard';
import { glassBorder, glassDark, glassLight } from '../../theme/surfaces';

jest.mock('expo-blur', () => {
  const React = require('react');

  return {
    BlurView: function MockBlurView({ children, ...props }) {
      return React.createElement('BlurView', props, children);
    },
  };
});

function renderCard(props = {}) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <GlassCard {...props}>
        <Text>Alpine child</Text>
      </GlassCard>
    );
  });
  return tree;
}

function blurView(tree) {
  return tree.root.findByType(require('expo-blur').BlurView);
}

describe('GlassCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders arbitrary children', () => {
    const tree = renderCard();
    expect(tree.root.findByType(Text).props.children).toBe('Alpine child');
    act(() => tree.unmount());
  });

  it('applies the default dark glass material', () => {
    const tree = renderCard();
    const view = blurView(tree);
    const style = StyleSheet.flatten(view.props.style);

    expect(view.props.tint).toBe('dark');
    expect(style.backgroundColor).toBe(glassDark);
    expect(style.borderColor).toBe(glassBorder);
    expect(style.borderRadius).toBe(20);
    act(() => tree.unmount());
  });

  it('applies the light glass material and caller overrides', () => {
    const tree = renderCard({
      variant: 'light',
      borderRadius: 14,
      style: { marginTop: 8 },
    });
    const view = blurView(tree);
    const style = StyleSheet.flatten(view.props.style);

    expect(view.props.tint).toBe('light');
    expect(style.backgroundColor).toBe(glassLight);
    expect(style.borderRadius).toBe(14);
    expect(style.marginTop).toBe(8);
    act(() => tree.unmount());
  });

  it('defaults to intensity 40 on iOS', () => {
    jest.spyOn(Platform, 'select').mockImplementation((options) => options.ios);
    expect(defaultIntensityForPlatform()).toBe(40);

    const tree = renderCard();
    expect(blurView(tree).props.intensity).toBe(40);
    act(() => tree.unmount());
  });

  it('defaults to intensity 60 on Android', () => {
    jest.spyOn(Platform, 'select').mockImplementation((options) => options.android);
    expect(defaultIntensityForPlatform()).toBe(60);

    const tree = renderCard();
    expect(blurView(tree).props.intensity).toBe(60);
    act(() => tree.unmount());
  });

  it('identifies Android API levels that need the solid fallback', () => {
    expect(usesAndroidFallback('android', 30)).toBe(true);
    expect(usesAndroidFallback('android', 31)).toBe(false);
    expect(usesAndroidFallback('ios', 17)).toBe(false);
  });
});
