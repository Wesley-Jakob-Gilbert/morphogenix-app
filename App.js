import React from 'react';
import { Text, View } from 'react-native';
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
import typography from './src/theme/typography';

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
// Establish Inter Regular as the app-wide default face so every <Text> that
// does not set its own family inherits Inter (the prior `family: undefined`
// rendered the platform system font everywhere). Big numerals / titles that
// need a heavier cut set their own family explicitly via the typography
// tokens; this only changes the *base* family, not the weight hierarchy.
//
// `Text.defaultProps` is the standard RN hook for a global default text style.
// Guarded so it is only set up once.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [
  { fontFamily: typography.family.regular },
  Text.defaultProps.style,
].filter(Boolean);

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
