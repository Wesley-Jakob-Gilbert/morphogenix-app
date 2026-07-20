import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import AccountScreen from '../screens/AccountScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import colors from '../theme/colors';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

const Tab = createBottomTabNavigator();

const icons = {
  Home: ['home', 'home-outline'],
  Analytics: ['analytics', 'analytics-outline'],
  History: ['calendar', 'calendar-outline'],
  Account: ['person', 'person-outline'],
};

// Roadmap V2 #3 — Frosted / translucent tab bar.
//
// Native floats a blurred dark material over the scrolling content (Apple
// TabView language); a top hairline reads as the material's edge. On web,
// BlurView degrades (the blur material is unreliable through the RNW SVG/CSS
// shim), so we fall back to a semi-opaque surface fill instead.
function FrostedTabBarBackground() {
  return (
    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
  );
}

const tabBarStyle = Platform.select({
  web: {
    position: 'absolute',
    // Web fallback: semi-opaque surface in place of the native blur material.
    backgroundColor: 'rgba(20, 27, 45, 0.85)',
    borderTopColor: colors.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    paddingTop: 8,
    paddingBottom: 12,
  },
  default: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopColor: colors.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    paddingTop: 8,
    paddingBottom: 12,
  },
});

// Native gets the real frosted material; web renders nothing extra (the
// semi-opaque backgroundColor above is the fallback).
const tabBarBackground =
  Platform.OS === 'web' ? undefined : () => <FrostedTabBarBackground />;

// Fire a selection haptic on every tab change (#3, via the #6 wrapper). No-op
// on web. Attached per-screen so it only triggers on actual tab presses.
const tabPressListeners = () => ({
  tabPress: () => {
    haptics.selection();
  },
});

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        // Float the bar over content (position: absolute). Screens pad their
        // scroll content so it scrolls UNDER the frosted bar, not behind it.
        tabBarStyle,
        tabBarBackground,
        tabBarLabelStyle: {
          fontSize: typography.sizes.tiny,
          // Named Inter family carries the weight; numeric fontWeight is a
          // no-op for bundled faces and was removed (Round 3 #8).
          fontFamily: typography.family.bold,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [activeIcon, inactiveIcon] = icons[route.name];
          return <Ionicons name={focused ? activeIcon : inactiveIcon} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} listeners={tabPressListeners} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} listeners={tabPressListeners} />
      <Tab.Screen name="History" component={HistoryScreen} listeners={tabPressListeners} />
      <Tab.Screen name="Account" component={AccountScreen} listeners={tabPressListeners} />
    </Tab.Navigator>
  );
}
