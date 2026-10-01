import { createServer } from "node:http";
import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { acceptRouterWebhook, ROUTER_PATH } from "./ingress";

export function createWebhookRouterServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (req.method === "GET" && url.pathname === "/health") {
        await db.execute(sql`select id from upstream_webhook_delivery limit 0`);
        res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
        return;
      }
      if (url.pathname !== ROUTER_PATH) {
        res.writeHead(404, { "content-type": "application/json" }).end('{"error":"not_found"}');
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value) headers.set(key, value);
      }
      const init: RequestInit & { duplex: "half" } = {
        method: req.method,
        headers,
        duplex: "half",
        ...(req.method !== "GET" && req.method !== "HEAD" ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array> } : {}),
      };
      const response = await acceptRouterWebhook(new Request(url, init));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(503, { "content-type": "application/json" }).end('{"error":"temporarily_unavailable"}');
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return server;
}
