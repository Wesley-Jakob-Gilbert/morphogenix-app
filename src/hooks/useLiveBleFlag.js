import useLiveModeFlag from './useLiveModeFlag';

export default function useLiveBleFlag() {
  return useLiveModeFlag().ble;
}
