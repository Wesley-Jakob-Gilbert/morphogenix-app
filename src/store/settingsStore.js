import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set) => ({
      demoMode: true,
      morphodayStartHour: 12,
      colorScaleMode: 'normalized',
      postureGoal: 80,
      setDemoMode: (demoMode) => set({ demoMode }),
      toggleDemoMode: () => set((state) => ({ demoMode: !state.demoMode })),
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
      partialize: (state) => ({
        demoMode: state.demoMode,
        morphodayStartHour: state.morphodayStartHour,
        colorScaleMode: state.colorScaleMode,
        postureGoal: state.postureGoal,
      }),
    }
  )
);

export default useSettingsStore;
