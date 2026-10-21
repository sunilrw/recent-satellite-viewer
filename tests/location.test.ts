import { describe, expect, it } from "vitest";
import { parseLocation, links } from "../src/location";

const near = (t: any, lat: number, lon: number) => {
  expect(t).not.toBeNull();
  expect(t.lat).toBeCloseTo(lat, 3);
  expect(t.lon).toBeCloseTo(lon, 3);
};

describe("parseLocation", () => {
  it("plain coordinates", () => near(parseLocation("-1.3863, 36.8737"), -1.3863, 36.8737));
  it("space separated", () => near(parseLocation("51.5 -0.12"), 51.5, -0.12));
  it("geo uri", () => { const t = parseLocation("geo:48.8566,2.3522?z=14"); near(t, 48.8566, 2.3522); expect(t!.zoom).toBe(14); });
  it("google @ link", () => { const t = parseLocation("https://www.google.com/maps/place/X/@-1.3733,36.8586,12z/data=1"); near(t, -1.3733, 36.8586); expect(t!.zoom).toBe(12); });
  it("google !3d!4d", () => near(parseLocation("https://maps.google.com/x/data=!3d40.7128!4d-74.006"), 40.7128, -74.006));
  it("google q=", () => near(parseLocation("https://maps.google.com/?q=35.36,138.72"), 35.36, 138.72));
  it("osm map hash", () => { const t = parseLocation("https://www.openstreetmap.org/#map=13/-1.39/36.87"); near(t, -1.39, 36.87); expect(t!.zoom).toBe(13); });
  it("our own link keeps source", () => {
    const t = parseLocation("http://localhost/#-1.4109,36.8509,13,modis_2026-10-19");
    near(t, -1.4109, 36.8509); expect(t!.source).toBe("modis");
  });
  it("rejects nonsense", () => { expect(parseLocation("hello")).toBeNull(); expect(parseLocation("99, 999")).toBeNull(); });
});

describe("links", () => {
  it("builds", () => {
    expect(links.geo({ lat: 1, lon: 2, zoom: 3 })).toBe("geo:1.000000,2.000000?z=3");
    expect(links.google({ lat: 1, lon: 2, zoom: 3 })).toContain("@1.000000,2.000000,3z");
  });
});
