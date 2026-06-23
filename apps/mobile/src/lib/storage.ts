import * as SecureStore from 'expo-secure-store';

const KEY = 'access_token';

export const storage = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY);
  },
  async setToken(value: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, value);
  },
  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
