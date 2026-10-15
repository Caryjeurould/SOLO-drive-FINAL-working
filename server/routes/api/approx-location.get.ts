import { defineEventHandler, getCookie, getRequestHeader, setResponseHeader } from "h3";
import { ROLE_COOKIE } from "../../../src/lib/site-role";

// Visitor demo only ("Go online" map): the visitor's APPROXIMATE area, read from
// the IP-based geo headers Vercel adds to every request. Returns only
// { lat, lng }, rounded to 2 decimals (about 1 km), or nulls when there's no geo
// data. Nothing is logged or stored, and the answer is never cached. (Behind the
// password wall like every other path; admins get nulls.)
const coord = (raw: string | undefined, limit: number): number | null => {
  if (!raw) return null;
  const v = Number(decodeURIComponent(raw).trim());
  return raw.trim() !== "" && Number.isFinite(v) && Math.abs(v) <= limit ? Math.round(v * 100) / 100 : null;
};

export default defineEventHandler((event) => {
  setResponseHeader(event, "cache-control", "no-store, private");
  if (getCookie(event, ROLE_COOKIE) !== "visitor") return { lat: null, lng: null };
  const lat = coord(getRequestHeader(event, "x-vercel-ip-latitude"), 90);
  const lng = coord(getRequestHeader(event, "x-vercel-ip-longitude"), 180);
  return lat != null && lng != null ? { lat, lng } : { lat: null, lng: null };
});
