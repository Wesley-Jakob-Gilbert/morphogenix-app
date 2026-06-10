import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useLiveBleFlag from '../../hooks/useLiveBleFlag';
import useSettingsStore from '../../store/settingsStore';
import BleStreamer, { isWebBluetoothAvailable } from './BleStreamer';
import DemoStreamer from './DemoStreamer';

export const StreamerContext = createContext({
  packet: null,
  isStreaming: false,
  source: 'none',
  // BLE-only fields — null/no-op when running the demo streamer:
  bleStatus: { state: 'idle', detail: null }, // 'idle' | 'scanning' | 'connecting' | 'connected' | 'silent' | 'error' | 'disconnected'
  connect: async () => {},
  disconnect: () => {},
  sendCommand: async () => {},
  isBleSupported: false,
  subscribe: () => () => {},
});

export default function StreamerProvider({ children }) {
  const demoMode = useSettingsStore((state) => state.demoMode);
  const liveBleFlag = useLiveBleFlag();

  // Selection rule:
  //   - Bench build with ?live=ble in the URL  -> BleStreamer
  //   - Everything else                        -> DemoStreamer
  // We deliberately do NOT key off settingsStore.demoMode for the BLE path,
  // because that flag is locked to `true` on web by design (see store).
  const useBle = liveBleFlag;

  const streamerRef = useRef(null);
  const [packet, setPacket] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [source, setSource] = useState('none');
  const [bleStatus, setBleStatus] = useState({ state: 'idle', detail: null });

  useEffect(() => {
    if (streamerRef.current) {
      streamerRef.current.stop();
    }

    const streamer = useBle ? new BleStreamer() : new DemoStreamer();
    streamerRef.current = streamer;
    setSource(streamer.getSource());
    setPacket(null);
    setIsStreaming(false);
    setBleStatus({ state: 'idle', detail: null });

    const unsubscribe = streamer.subscribe((nextEvent) => {
      // BleStreamer multiplexes packets and status on the same channel; demux.
      if (nextEvent && nextEvent.type === 'status') {
        setBleStatus({ state: nextEvent.state, detail: nextEvent.detail });
        // 'connected' alone doesn't mean data is flowing; isStreaming flips
        // once the first real packet arrives. 'silent'/'disconnected'/'error'
        // turn it back off.
        if (
          nextEvent.state === 'idle' ||
          nextEvent.state === 'disconnected' ||
          nextEvent.state === 'error' ||
          nextEvent.state === 'silent'
        ) {
          setIsStreaming(false);
        }
        return;
      }
      setPacket(nextEvent);
      setIsStreaming(true);
    });

    streamer.start();

    // DemoStreamer streams immediately; BleStreamer waits for the user to
    // tap "Connect device". So only assert isStreaming for demo here.
    if (!useBle) {
      setIsStreaming(true);
    }

    return () => {
      unsubscribe();
      streamer.stop();
      setIsStreaming(false);
    };
  }, [useBle, demoMode]);

  const connect = useCallback(async () => {
    const streamer = streamerRef.current;
    if (!streamer || typeof streamer.connect !== 'function') return;
    await streamer.connect();
  }, []);

  const disconnect = useCallback(() => {
    const streamer = streamerRef.current;
    if (!streamer || typeof streamer.disconnect !== 'function') return;
    streamer.disconnect();
  }, []);

  const sendCommand = useCallback(async (command) => {
    const streamer = streamerRef.current;
    if (!streamer || typeof streamer.sendCommand !== 'function') return;
    await streamer.sendCommand(command);
  }, []);

  // Hydration-safe Web Bluetooth capability check.
  // Server prerender has no `navigator` global, so referencing it during
  // render would throw and tear down the tree. We start at `false` (matches
  // server output exactly), then flip to the real value in useEffect once
  // we're guaranteed to be on the client.
  const [isBleSupported, setIsBleSupported] = useState(false);
  useEffect(() => {
    setIsBleSupported(isWebBluetoothAvailable());
  }, []);

  const value = useMemo(
    () => ({
      packet,
      isStreaming,
      source,
      bleStatus,
      connect,
      disconnect,
      sendCommand,
      isBleSupported,
      subscribe: (callback) => {
        if (!streamerRef.current) return () => {};
        return streamerRef.current.subscribe(callback);
      },
    }),
    [packet, isStreaming, source, bleStatus, connect, disconnect, sendCommand, isBleSupported]
  );

  return <StreamerContext.Provider value={value}>{children}</StreamerContext.Provider>;
}
