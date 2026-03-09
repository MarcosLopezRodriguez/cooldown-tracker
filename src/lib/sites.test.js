import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  clearCooldown,
  getSiteView,
  getVisibleSites,
  normalizeSettings,
  normalizeSite,
  parseImportPayload,
  resolveExpiredCooldowns,
  startCooldown,
} from "./sites.js";

describe("normalizeSettings", () => {
  it("maps legacy flags to the new settings shape", () => {
    expect(
      normalizeSettings({
        defaultDurationMs: 15 * 60 * 1000,
        notifications: true,
        sound: false,
      }),
    ).toEqual({
      defaultDurationMs: 15 * 60 * 1000,
      notificationsOn: true,
      soundOn: false,
    });
  });
});

describe("normalizeSite", () => {
  it("accepts legacy scope and builds sane defaults", () => {
    const site = normalizeSite(
      {
        id: "one",
        url: "example.com/articles",
        scope: "url",
      },
      { now: 10_000, defaultDurationMs: 120_000 },
    );

    expect(site).toMatchObject({
      id: "one",
      url: "https://example.com/articles",
      scope: "exact",
      durationMs: 120_000,
      label: "example.com",
      endAt: null,
    });
  });

  it("filters out invalid URLs", () => {
    expect(normalizeSite({ url: "::not-valid::" })).toBeNull();
  });
});

describe("parseImportPayload", () => {
  it("imports legacy arrays and filters invalid entries", () => {
    const payload = JSON.stringify([
      { id: "valid", url: "example.com", scope: "url" },
      { id: "invalid", url: "::invalid::" },
    ]);

    const parsed = parseImportPayload(payload, { now: 5_000 });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].scope).toBe("exact");
  });

  it("allows importing settings without items", () => {
    const parsed = parseImportPayload(
      JSON.stringify({
        settings: {
          defaultDurationMs: 5 * 60 * 1000,
          notifications: true,
          sound: false,
        },
      }),
    );

    expect(parsed.items).toEqual([]);
    expect(parsed.settings).toEqual({
      defaultDurationMs: 5 * 60 * 1000,
      notificationsOn: true,
      soundOn: false,
    });
  });
});

describe("cooldown actions", () => {
  const baseSite = normalizeSite(
    {
      id: "site",
      url: "https://example.com",
      label: "Example",
      durationMs: 60_000,
      createdAt: 1_000,
    },
    { now: 1_000 },
  );

  it("starts and clears cooldowns", () => {
    const started = startCooldown([baseSite], "site", 2_000);
    expect(started[0]).toMatchObject({
      lastVisitedAt: 2_000,
      endAt: 62_000,
    });

    const cleared = clearCooldown(started, "site", 3_000);
    expect(cleared[0].endAt).toBeNull();
  });

  it("resolves expired cooldowns once", () => {
    const active = startCooldown([baseSite], "site", 2_000);
    const resolved = resolveExpiredCooldowns(active, 62_000);

    expect(resolved.completed).toHaveLength(1);
    expect(resolved.items[0].endAt).toBeNull();
  });
});

describe("derived views", () => {
  it("builds export payloads with a version", () => {
    const payload = buildExportPayload(
      [
        {
          id: "site",
          url: "https://example.com",
          label: "Example",
          scope: "domain",
          durationMs: 60_000,
          endAt: null,
          lastVisitedAt: null,
          createdAt: 1_000,
          updatedAt: 1_000,
          favicon: null,
        },
      ],
      {
        defaultDurationMs: 60_000,
        notificationsOn: false,
        soundOn: true,
      },
      "2026-03-08T12:00:00.000Z",
    );

    expect(payload.version).toBe(2);
    expect(payload.exportedAt).toBe("2026-03-08T12:00:00.000Z");
  });

  it("filters and sorts visible sites", () => {
    const items = [
      {
        id: "a",
        url: "https://a.example.com",
        label: "A",
        scope: "domain",
        durationMs: 60_000,
        endAt: 80_000,
        lastVisitedAt: 20_000,
        createdAt: 10_000,
        updatedAt: 20_000,
        favicon: null,
      },
      {
        id: "b",
        url: "https://b.example.com",
        label: "B",
        scope: "domain",
        durationMs: 60_000,
        endAt: null,
        lastVisitedAt: null,
        createdAt: 10_000,
        updatedAt: 20_000,
        favicon: null,
      },
    ];

    const activeOnly = getVisibleSites(items, { filter: "active", now: 40_000 });
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe("a");

    const readyView = getSiteView(items[1], 40_000);
    expect(readyView.ready).toBe(true);
    expect(readyView.progress).toBe(100);
  });
});
