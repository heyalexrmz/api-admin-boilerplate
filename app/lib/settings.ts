export const SETTINGS_TABS = [
  "account",
  "organization",
  "billing",
  "security",
  "appearance",
  "notifications",
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

export function parseSettingsTab(value: string | undefined): SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab)
    ? (value as SettingsTab)
    : "account"
}
