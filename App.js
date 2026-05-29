import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import StreamerProvider from './src/services/streamer/StreamerProvider';
import colors from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <StreamerProvider>
        <StatusBar style="light" backgroundColor={colors.navy} />
        <RootNavigator />
      </StreamerProvider>
    </SafeAreaProvider>
  );
}
