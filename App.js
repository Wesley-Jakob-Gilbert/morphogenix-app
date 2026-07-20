import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import RootNavigator from './src/navigation/RootNavigator';
import StreamerProvider from './src/services/streamer/StreamerProvider';
import colors from './src/theme/colors';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.navy,
    card: colors.surface,
    primary: colors.teal,
    text: colors.white,
    border: colors.surface,
  },
};

// Roadmap V2 #1 — Inter font system.
//
// The app-wide default Inter Regular face is now applied by the `AppText`
// wrapper component (src/components/AppText.js), which screens/components import
// in place of react-native's <Text>. This replaced the old
// `Text.defaultProps.style = [...]` global mutation (Round 3 #11) — that hook
// is deprecated in React 18 / RN 0.7x and mutated shared state at import time.
// Big numerals / titles still set their own heavier family explicitly.

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  // Gate the root render until Inter is registered so the first frame is not
  // a system-font flash that then re-lays-out. This is a minimal placeholder
  // matching the app floor color — NOT a SplashScreen change (separate concern).
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.base }} />;
  }

  return (
    <StreamerProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" backgroundColor={colors.navy} />
        <RootNavigator />
      </NavigationContainer>
    </StreamerProvider>
  );
}
