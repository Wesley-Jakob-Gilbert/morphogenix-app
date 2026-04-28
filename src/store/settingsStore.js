import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from './persistSettings';

const isWeb = Platform.OS === 'web';

const useSettingsStore = create(
  persist(
    (set) => ({
      demoMode: true,
      morphodayStartHour: 12,
      colorScaleMode: 'normalized',
      postureGoal: 80,
      setDemoMode: (demoMode) => set({ demoMode: isWeb ? true : demoMode }),
      toggleDemoMode: () => set((state) => ({ demoMode: isWeb ? true : !state.demoMode })),
      setMorphodayStartHour: (morphodayStartHour) => set({ morphodayStartHour }),
      setColorScaleMode: (colorScaleMode) => set({ colorScaleMode }),
      toggleColorScaleMode: () =>
        set((state) => ({
          colorScaleMode: state.colorScaleMode === 'newtons' ? 'normalized' : 'newtons',
        })),
      setPostureGoal: (postureGoal) => set({ postureGoal }),
    }),
    {
      name: 'morphogenix-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        demoMode: isWeb ? true : persistedState?.demoMode ?? currentState.demoMode,
      }),
      partialize: (state) => ({
        demoMode: isWeb ? true : state.demoMode,
        morphodayStartHour: state.morphodayStartHour,
        colorScaleMode: state.colorScaleMode,
        postureGoal: state.postureGoal,
      }),
    }
  )
);

export default useSettingsStore;
