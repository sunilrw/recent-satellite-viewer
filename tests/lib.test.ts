import { describe, expect, it } from "vitest";
import { ageText, haversineKm } from "../src/format";
import { decodeHash, encodeHash } from "../src/hash";

describe("ageText", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("hours under two days", () => expect(ageText("2026-10-20T00:00:00Z", now)).toBe("12 hours ago"));
  it("days after", () => expect(ageText("2026-10-13T12:00:00Z", now)).toBe("7 days ago"));
  it("fresh", () => expect(ageText("2026-10-20T11:50:00Z", now)).toBe("less than an hour ago"));
});

describe("hash", () => {
  it("round trips", () => {
    const v = { lat: -1.3863, lon: 36.8737, zoom: 12, scene: "S2C_37MBU_20261019_1_L2A" };
    expect(decodeHash(encodeHash(v))).toEqual(v);
  });
  it("rejects junk", () => {
    expect(decodeHash("#abc")).toBeNull();
    expect(decodeHash("#99,0,5")).toBeNull();
  });
});

describe("haversine", () => {
  it("London to Paris is ~344 km", () => {
    expect(haversineKm([51.5074, -0.1278], [48.8566, 2.3522])).toBeGreaterThan(340);
    expect(haversineKm([51.5074, -0.1278], [48.8566, 2.3522])).toBeLessThan(348);
  });
});
