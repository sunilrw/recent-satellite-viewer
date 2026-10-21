import type L from "leaflet";
import type { SourceId } from "./sources";

export interface GoTarget {
  lat: number;
  lon: number;
  name?: string;
  zoom?: number;
  /** [south, west, north, east] */
  bounds?: [number, number, number, number];
  source?: SourceId;
  /** Open a before/after swipe comparison instead of the normal image list. */
  compare?: { before: string; after: string };
}

export interface Ctx {
  map: L.Map;
  goTo(t: GoTarget): void;
  currentSource(): SourceId;
  lastName(): string;
  toast(text: string): void;
  showTab(tab: string): void;
  clearImage(): void;
  restore(): void;
}

export const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
