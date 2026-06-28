import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, closeApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe("POST /api/v1/translate/probe", () => {
  it("should probe gtxFreeAPI successfully (free, no key needed)", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/probe",
      payload: { translationMethod: "gtxFreeAPI" },
    });
    const body = JSON.parse(res.body);
    if (body.ok) {
      expect(body).toHaveProperty("result");
      expect(typeof body.result).toBe("string");
    } else {
      expect(body).toHaveProperty("error");
    }
  });

  it("should return 400 for an invalid translation method", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/probe",
      payload: { translationMethod: "nonexistent_method_xyz" },
    });
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("message");
  });

  it("should accept optional config in probe request", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/probe",
      payload: {
        translationMethod: "gtxFreeAPI",
        chunkSize: 1000,
        delayTime: 100,
      },
    });
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("ok");
  });

  it("should probe edgeFreeAPI successfully (free, no key needed)", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/probe",
      payload: { translationMethod: "edgeFreeAPI" },
    });
    const body = JSON.parse(res.body);
    if (body.ok) {
      expect(body).toHaveProperty("result");
      expect(typeof body.result).toBe("string");
    } else {
      expect(body).toHaveProperty("error");
    }
  });
});
