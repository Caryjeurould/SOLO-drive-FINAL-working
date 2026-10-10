// SOLO.drive service worker — deliberately minimal.
//
// It exists only so browsers treat SOLO.drive as an installable app. It caches
// nothing and has no fetch handler, so every request (pages, Mapbox, sign-in,
// the database) goes straight to the network exactly as without it: no stale
// pages, no offline mode.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
