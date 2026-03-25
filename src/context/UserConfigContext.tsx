import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { getUserConfig, updateUserConfig, DEFAULT_USER_CONFIG } from "../ipc/config";
import type { UserConfig } from "../ipc/config";

interface UserConfigContextValue {
  config: UserConfig;
  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
}

const UserConfigContext = createContext<UserConfigContextValue>({
  config: DEFAULT_USER_CONFIG,
  updateConfig: async () => {},
});

export function UserConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<UserConfig>(DEFAULT_USER_CONFIG);

  useEffect(() => {
    getUserConfig()
      .then(setConfig)
      .catch((err) => console.error("Failed to load user config:", err));
  }, []);

  const updateConfig = useCallback(async (updates: Partial<UserConfig>) => {
    const next = { ...config, ...updates };
    setConfig(next);
    try {
      await updateUserConfig(next);
    } catch (err) {
      console.error("Failed to save user config:", err);
    }
  }, [config]);

  return (
    <UserConfigContext.Provider value={{ config, updateConfig }}>
      {children}
    </UserConfigContext.Provider>
  );
}

export function useUserConfig() {
  return useContext(UserConfigContext);
}
