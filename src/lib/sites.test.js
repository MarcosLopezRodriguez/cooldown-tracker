import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  buildExportPayload,
  deriveVisibleSites,
  expireCooldowns,
  normalizeSettings,
  normalizeSite,
  normalizeUrl,
  parseImportPayload,
} from "./sites";

describe("normalizeUrl", () => {
  it("adds https when protocol is missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("returns null for invalid input", () => {
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("normalizeSettings", () => {
  it("migrates legacy notification and sound fields", () => {
    expect(normalizeSettings({
      defaultDurationMs: 120000,
      notifications: false,
      sound: false,
    })).toEqual({
      defaultDurationMs: 120000,
      notificationsOn: false,
      soundOn: false,
    });
  });

  it("falls back to defaults for invalid values", () => {
    expect(normalizeSettings({ defaultDurationMs: 1 })).toEqual(DEFAULT_SETTINGS);
  });
});

describe("parseImportPayload", () => {
  it("accepts legacy array payloads", () => {
    const payload = parseImportPayload([
      { url: "example.com", scope: "url", durationMs: 60000 },
    ]);

    expect(payload.version).toBe(1);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].scope).toBe("exact");
  });

  it("normalizes structured payloads with settings", () => {
    const payload = parseImportPayload({
      version: 2,
      items: [{ url: "https://example.com", durationMs: 60000 }],
      settings: { notifications: false, sound: false, defaultDurationMs: 180000 },
    });

    expect(payload.items).toHaveLength(1);
    expect(payload.settings).toEqual({
      defaultDurationMs: 180000,
      notificationsOn: false,
      soundOn: false,
    });
  });

  it("rejects payloads without importable content", () => {
    expect(() => parseImportPayload({ foo: "bar" })).toThrow("Formato de importacion no valido.");
  });
});

describe("buildExportPayload", () => {
  it("exports versioned normalized data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));

    const payload = buildExportPayload(
      [{ url: "example.com", durationMs: 60000 }],
      { notificationsOn: false, soundOn: true, defaultDurationMs: 60000 },
    );

    expect(payload.version).toBe(2);
    expect(payload.items[0].url).toBe("https://example.com/");
    expect(payload.exportedAt).toBe("2026-03-09T12:00:00.000Z");

    vi.useRealTimers();
  });
});

describe("expireCooldowns", () => {
  it("clears expired cooldowns and preserves active ones", () => {
    const items = [
      normalizeSite({
        id: "expired",
        url: "https://expired.test",
        durationMs: 60000,
        endAt: 1000,
        lastVisitedAt: 0,
        updatedAt: 0,
        createdAt: 0,
      }),
      normalizeSite({
        id: "active",
        url: "https://active.test",
        durationMs: 60000,
        endAt: 5000,
        lastVisitedAt: 0,
        updatedAt: 0,
        createdAt: 0,
      }),
    ];

    const result = expireCooldowns(items, 2000);

    expect(result.changed).toBe(true);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].id).toBe("expired");
    expect(result.next[0].endAt).toBeNull();
    expect(result.next[1].endAt).toBe(5000);
  });
});

describe("deriveVisibleSites", () => {
  const items = [
    normalizeSite({
      id: "active",
      url: "https://alpha.test",
      label: "Alpha",
      durationMs: 60000,
      endAt: 5000,
      lastVisitedAt: 0,
      updatedAt: 0,
      createdAt: 0,
    }),
    normalizeSite({
      id: "ready",
      url: "https://beta.test",
      label: "Beta",
      durationMs: 60000,
      endAt: null,
      lastVisitedAt: null,
      updatedAt: 0,
      createdAt: 0,
    }),
  ];

  it("filters active items", () => {
    const shown = deriveVisibleSites(items, { filter: "active", now: 1000, query: "" });
    expect(shown.map((item) => item.id)).toEqual(["active"]);
  });

  it("filters ready items", () => {
    const shown = deriveVisibleSites(items, { filter: "ready", now: 1000, query: "" });
    expect(shown.map((item) => item.id)).toEqual(["ready"]);
  });

  it("filters by query across label and url", () => {
    const shown = deriveVisibleSites(items, { filter: "all", now: 1000, query: "beta" });
    expect(shown.map((item) => item.id)).toEqual(["ready"]);
  });
});
