import { useContext } from 'react';

import { StreamerContext } from '../services/streamer/StreamerProvider';

export default function useStream() {
  return useContext(StreamerContext);
}
