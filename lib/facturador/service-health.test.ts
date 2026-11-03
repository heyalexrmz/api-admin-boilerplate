import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/webhook-dispatch", () => ({ dispatchOrganizationWebhookEvent: vi.fn() }));

import { ApiError, errorResponse } from "@/lib/api-contracts";
import {
  computeServiceHealth,
  HEALTH_THRESHOLDS,
  serviceEventForTransition,
  type HealthSignals,
} from "./service-health";

const now = new Date("2026-11-03T12:00:00Z");
const healthy: HealthSignals = {
  databaseOk: true,
  measured: true,
  lastHeartbeatAt: new Date(now.getTime() - 1_000),
  oldestDueSubmitAt: null,
  outcomes: { total: 10, infrastructureFailures: 0, rateLimited: 0 },
  overrides: [],
};
const health = (signals: Partial<HealthSignals>) => computeServiceHealth("live", { ...healthy, ...signals }, now);

describe("computeServiceHealth", () => {
  it("is operational with a live worker and successful outcomes", () => {
    expect(health({})).toMatchObject({ status: "operational", retry_after_seconds: null });
  });

  it("marks extraction down when the worker heartbeat is stale", () => {
    const result = health({ lastHeartbeatAt: new Date(now.getTime() - HEALTH_THRESHOLDS.heartbeatStaleMs - 1) });
    expect(result).toMatchObject({ status: "down", retry_after_seconds: 60, components: { extraction: { status: "down" } } });
  });

  it("grades queue lag", () => {
    expect(health({ oldestDueSubmitAt: new Date(now.getTime() - 2 * 60_000) }).components.extraction.status).toBe("degraded");
    expect(health({ oldestDueSubmitAt: new Date(now.getTime() - 6 * 60_000) }).components.extraction.status).toBe("down");
  });

  it("grades invoicing by the share of recent infrastructure failures", () => {
    expect(health({ outcomes: { total: 10, infrastructureFailures: 2, rateLimited: 0 } }).components.invoicing.status).toBe("degraded");
    expect(health({ outcomes: { total: 10, infrastructureFailures: 5, rateLimited: 0 } }).components.invoicing.status).toBe("down");
    expect(health({ outcomes: { total: 2, infrastructureFailures: 2, rateLimited: 0 } }).components.invoicing.status).toBe("operational");
    expect(health({ outcomes: { total: 10, infrastructureFailures: 1, rateLimited: 1 } }).components.invoicing.status).toBe("degraded");
  });

  it("reports everything down when the database is unreachable", () => {
    expect(health({ databaseOk: false })).toMatchObject({ status: "down", components: { ingest: { status: "down" } } });
  });

  it("applies overrides only to worsen a component", () => {
    const result = health({ overrides: [{ component: "extraction", status: "down", reason: "Apagado." }] });
    expect(result.components.extraction).toEqual({ status: "down", reason: "Apagado." });
    const notBetter = health({
      lastHeartbeatAt: null,
      measured: true,
      overrides: [],
    });
    expect(notBetter.components.extraction.status).toBe("degraded");
  });

  it("ignores worker and provider signals for sandbox", () => {
    const result = computeServiceHealth("test", { ...healthy, measured: false, lastHeartbeatAt: null }, now);
    expect(result.status).toBe("operational");
  });

  it("never mentions internal providers in reasons", () => {
    const result = health({ databaseOk: true, lastHeartbeatAt: null, outcomes: { total: 10, infrastructureFailures: 9, rateLimited: 1 } });
    expect(JSON.stringify(result)).not.toMatch(/tocino|nova|timbre/i);
  });
});

describe("serviceEventForTransition", () => {
  it.each([
    ["operational", "down", "service.down"],
    ["operational", "degraded", "service.degraded"],
    ["down", "degraded", "service.degraded"],
    ["down", "operational", "service.recovered"],
    ["degraded", "operational", "service.recovered"],
    ["down", "down", null],
  ] as const)("%s -> %s emits %s", (previous, next, event) => {
    expect(serviceEventForTransition(previous, next)).toBe(event);
  });
});

describe("API error contract", () => {
  it("sends Retry-After and retryable for 503", async () => {
    const response = errorResponse(
      new ApiError({ status: 503, code: "SERVICE_UNAVAILABLE", type: "unavailable", message: "x", retryAfterSeconds: 60 }),
      "req-1"
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({
      error: { code: "SERVICE_UNAVAILABLE", type: "unavailable", message: "x", param: null, retryable: true },
      request_id: "req-1",
    });
  });

  it("marks 4xx as not retryable by default", async () => {
    const response = errorResponse(new ApiError({ status: 400, code: "invalid_json", type: "validation_error", message: "x" }), "r");
    expect((await response.json()).error.retryable).toBe(false);
    expect(response.headers.get("Retry-After")).toBeNull();
  });
});
