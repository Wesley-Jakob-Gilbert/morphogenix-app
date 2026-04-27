import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';

import useSettingsStore from '../../store/settingsStore';
import BleStreamer from './BleStreamer';
import DemoStreamer from './DemoStreamer';

export const StreamerContext = createContext({
  packet: null,
  isStreaming: false,
  source: 'none',
  subscribe: () => () => {},
});

export default function StreamerProvider({ children }) {
  const demoMode = useSettingsStore((state) => state.demoMode);
  const streamerRef = useRef(null);
  const [packet, setPacket] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [source, setSource] = useState('none');

  useEffect(() => {
    if (streamerRef.current) {
      streamerRef.current.stop();
    }

    const streamer = demoMode ? new DemoStreamer() : new BleStreamer();
    streamerRef.current = streamer;
    setSource(streamer.getSource());
    setPacket(null);

    const unsubscribe = streamer.subscribe((nextPacket) => {
      setPacket(nextPacket);
      setIsStreaming(true);
    });

    streamer.start();
    setIsStreaming(demoMode);

    return () => {
      unsubscribe();
      streamer.stop();
      setIsStreaming(false);
    };
  }, [demoMode]);

  const value = useMemo(
    () => ({
      packet,
      isStreaming,
      source,
      subscribe: (callback) => {
        if (!streamerRef.current) return () => {};
        return streamerRef.current.subscribe(callback);
      },
    }),
    [packet, isStreaming, source]
  );

  return <StreamerContext.Provider value={value}>{children}</StreamerContext.Provider>;
}
