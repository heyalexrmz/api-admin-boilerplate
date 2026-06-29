type UaSummary = {
  device: string
  isMobile: boolean
}

const MOBILE_OS = ["iPhone", "iPad", "Android", "Mobile"] as const

const BROWSERS: { token: string; label: string }[] = [
  { token: "Edg/", label: "Edge" },
  { token: "OPR/", label: "Opera" },
  { token: "Chrome/", label: "Chrome" },
  { token: "Firefox/", label: "Firefox" },
  { token: "Safari/", label: "Safari" },
]

const OS_LABELS: { token: string; label: string }[] = [
  { token: "iPhone", label: "iPhone" },
  { token: "iPad", label: "iPad" },
  { token: "Android", label: "Android" },
  { token: "Mac OS X", label: "Mac" },
  { token: "Macintosh", label: "Mac" },
  { token: "Windows", label: "Windows" },
  { token: "Linux", label: "Linux" },
]

export function describeUserAgent(userAgent: string | null): UaSummary {
  if (!userAgent) {
    return { device: "Unknown device", isMobile: false }
  }

  const os =
    OS_LABELS.find((entry) => userAgent.includes(entry.token))?.label ?? "Unknown device"
  const browser =
    BROWSERS.find((entry) => userAgent.includes(entry.token))?.label ?? "Unknown browser"
  const isMobile = MOBILE_OS.some((token) => userAgent.includes(token))

  if (os === "Unknown device" && browser === "Unknown browser") {
    return { device: "Unknown device", isMobile }
  }
  if (os === "Unknown device") {
    return { device: browser, isMobile }
  }
  if (browser === "Unknown browser") {
    return { device: os, isMobile }
  }
  return { device: `${os} · ${browser}`, isMobile }
}
