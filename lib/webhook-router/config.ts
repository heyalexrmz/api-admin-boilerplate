import { validateWebhookUrlSyntax } from "@/lib/webhook-url-policy";

export type RouterConfig = {
  headerName: string;
  token: string;
  forwardUrls: string[];
};

export function getRouterConfig(env: Record<string, string | undefined> = process.env): RouterConfig {
  const headerName = (env.UPSTREAM_WEBHOOK_HEADER || "typeform-signature").toLowerCase();
  const token = env.UPSTREAM_WEBHOOK_TOKEN;
  if (!token || /[\r\n]/.test(token)) throw new Error("UPSTREAM_WEBHOOK_TOKEN is required and must be a single line.");
  if (!/^[a-z0-9-]+$/.test(headerName) || [
    "content-type", "content-length", "host", "connection", "transfer-encoding",
    "idempotency-key", "x-webhook-event-id", "x-webhook-router-hop",
  ].includes(headerName)) throw new Error("Invalid UPSTREAM_WEBHOOK_HEADER.");

  let urls: unknown;
  try { urls = JSON.parse(env.WEBHOOK_ROUTER_FORWARD_URLS || "[]"); }
  catch { throw new Error("WEBHOOK_ROUTER_FORWARD_URLS must be a JSON array of HTTPS URLs."); }
  if (!Array.isArray(urls) || urls.length > 20 || urls.some((url) =>
    typeof url !== "string" || validateWebhookUrlSyntax(url) || new URL(url).hash
  )) throw new Error("WEBHOOK_ROUTER_FORWARD_URLS must contain up to 20 public HTTPS URLs without fragments.");

  return { headerName, token, forwardUrls: [...new Set((urls as string[]).map((url) => new URL(url).href))] };
}
