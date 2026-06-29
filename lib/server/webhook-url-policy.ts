import { lookup } from "node:dns/promises";

import {
  isBlockedWebhookAddress,
  validateWebhookUrlSyntax,
} from "@/lib/webhook-url-policy";

export async function validateWebhookUrlForDelivery(
  value: string
): Promise<string | null> {
  const syntaxError = validateWebhookUrlSyntax(value);
  if (syntaxError) return syntaxError;

  const { hostname: rawHostname } = new URL(value);
  const hostname = rawHostname.replace(/^\[(.*)\]$/, "$1");
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return "Webhook hostname could not be resolved.";
    if (addresses.some((record) => isBlockedWebhookAddress(record.address))) {
      return "Webhook hostname resolves to a private or reserved address.";
    }
  } catch {
    return "Webhook hostname could not be resolved.";
  }

  return null;
}

export async function assertWebhookUrlForDelivery(value: string): Promise<void> {
  const error = await validateWebhookUrlForDelivery(value);
  if (error) throw new Error(error);
}
