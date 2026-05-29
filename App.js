import React from 'react';
import { StatusBar } from 'expo-status-bar';

import RootNavigator from './src/navigation/RootNavigator';
import StreamerProvider from './src/services/streamer/StreamerProvider';
import colors from './src/theme/colors';

export default function App() {
  return (
    <StreamerProvider>
      <StatusBar style="light" backgroundColor={colors.navy} />
      <RootNavigator />
    </StreamerProvider>
  );
}
