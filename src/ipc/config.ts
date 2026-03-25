import { invoke } from "@tauri-apps/api/core";

export interface UserConfig {
  theme: string; // "light" | "dark" | "auto"
  auto_save_interval_ms: number;
  font_size: number;
  font_family: string;
  spell_check: boolean;
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  theme: "auto",
  auto_save_interval_ms: 1000,
  font_size: 16,
  font_family: "system",
  spell_check: true,
};

export function getUserConfig(): Promise<UserConfig> {
  return invoke("get_user_config");
}

export function updateUserConfig(config: UserConfig): Promise<void> {
  return invoke("update_user_config", { config });
}
