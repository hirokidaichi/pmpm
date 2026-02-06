import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, type TestApp } from "../helpers/app.js";

describe("GET /health", () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  it("200 OK を返す", async () => {
    const res = await testApp.app.request("/health");
    expect(res.status).toBe(200);
  });

  it("status: ok を含むJSONを返す", async () => {
    const res = await testApp.app.request("/health");
    const body = await res.json();

    expect(body.status).toBe("ok");
  });

  it("timestamp を含む", async () => {
    const before = Date.now();
    const res = await testApp.app.request("/health");
    const after = Date.now();
    const body = await res.json();

    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
  });

  it("Content-Type が application/json である", async () => {
    const res = await testApp.app.request("/health");
    const contentType = res.headers.get("content-type");

    expect(contentType).toContain("application/json");
  });
});
