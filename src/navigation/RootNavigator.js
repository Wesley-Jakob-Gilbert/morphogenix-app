import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AccountScreen from '../screens/AccountScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import colors from '../theme/colors';
import typography from '../theme/typography';

const icons = {
  Home: ['home', 'home-outline'],
  Analytics: ['analytics', 'analytics-outline'],
  History: ['calendar', 'calendar-outline'],
  Account: ['person', 'person-outline'],
};

const screens = {
  Home: HomeScreen,
  Analytics: AnalyticsScreen,
  History: HistoryScreen,
  Account: AccountScreen,
};

const tabs = Object.keys(screens);

export default function RootNavigator() {
  const [activeTab, setActiveTab] = useState('Home');
  const [paramsByTab, setParamsByTab] = useState({});
  const ActiveScreen = screens[activeTab];

  const navigation = useMemo(
    () => ({
      navigate: (name, params) => {
        if (!screens[name]) return;
        setParamsByTab((current) => ({ ...current, [name]: params || {} }));
        setActiveTab(name);
      },
    }),
    []
  );

  const route = useMemo(
    () => ({ name: activeTab, params: paramsByTab[activeTab] || {} }),
    [activeTab, paramsByTab]
  );

  return (
    <View style={styles.shell}>
      <View style={styles.scene}>
        <ActiveScreen navigation={navigation} route={route} />
      </View>
      <View style={styles.tabBar}>
        {tabs.map((name) => {
          const focused = activeTab === name;
          const [activeIcon, inactiveIcon] = icons[name];
          const color = focused ? colors.teal : colors.muted;

          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => navigation.navigate(name)}
              style={styles.tab}
            >
              <Ionicons name={focused ? activeIcon : inactiveIcon} color={color} size={24} />
              <Text style={[styles.label, { color }]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scene: {
    flex: 1,
  },
  tabBar: {
    minHeight: 72,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
});
