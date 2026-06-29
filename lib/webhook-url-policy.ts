const BLOCKED_HOSTNAMES = new Set(["localhost"]);

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return bytes.every(Number.isInteger) ? bytes : null;
}

function isBlockedIPv4(address: string): boolean {
  const bytes = parseIPv4(address);
  if (!bytes) return false;

  const [a, b] = bytes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const embeddedIPv4 = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIPv4?.[1] && isBlockedIPv4(embeddedIPv4[1])) return true;

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

export function isBlockedWebhookAddress(address: string): boolean {
  return isBlockedIPv4(address) || isBlockedIPv6(address);
}

export function validateWebhookUrlSyntax(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a valid URL.";
  }

  if (url.protocol !== "https:") return "Webhook URLs must use HTTPS.";
  if (url.username || url.password) return "Webhook URLs cannot include credentials.";
  if (url.port && url.port !== "443") return "Webhook URLs must use the default HTTPS port.";

  const hostname = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return "Webhook URLs must use a public hostname.";
  }

  if (!hostname.includes(".") && !parseIPv4(hostname) && !hostname.includes(":")) {
    return "Webhook URLs must use a public fully qualified hostname.";
  }

  if (isBlockedWebhookAddress(hostname)) {
    return "Webhook URLs cannot target private or reserved addresses.";
  }

  return null;
}

export function isValidWebhookUrlSyntax(value: string): boolean {
  return validateWebhookUrlSyntax(value) === null;
}
