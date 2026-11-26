import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Token sparas i Keychain/Keystore på telefon. På webben (bara för utveckling) i localStorage. */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { globalThis.localStorage?.setItem(key, value); } catch { /* ignoreras */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { globalThis.localStorage?.removeItem(key); } catch { /* ignoreras */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
