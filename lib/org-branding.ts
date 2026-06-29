/** Distinct accent colors for organization avatars. */
export const ORG_COLORS = [
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
] as const

export function randomOrgColor(): string {
  return ORG_COLORS[Math.floor(Math.random() * ORG_COLORS.length)]
}

/** Stable color for orgs created before color was stored. */
export function colorFromOrgId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return ORG_COLORS[hash % ORG_COLORS.length]
}

export function getOrgColor(org: { id: string; color?: string | null }): string {
  return org.color?.trim() || colorFromOrgId(org.id)
}

export function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
