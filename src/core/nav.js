// Moving around: navigation inside a dashboard, tab switches, the details dialog.

export const isNight = (hass, sun = "sun.sun") => hass?.states?.[sun || "sun.sun"]?.state === "below_horizon";

export function moreInfo(el, entityId) {
  if (entityId) el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

// Remember which tab to come back to, then navigate inside the dashboard
export function navigate(basePath, path, tab) {
  if (tab) { try { sessionStorage.setItem("nice-tab", tab); } catch (e) { /* storage blocked */ } }
  const base = basePath || window.location.pathname.split("/").slice(0, 2).join("/");
  window.history.pushState(null, "", path.startsWith("/") ? path : `${base}/${path}`);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

// Ask the surrounding nice-tabs for a tab
export const askTab = (el, tab) => el.dispatchEvent(new CustomEvent("nice-tab", { detail: { tab }, bubbles: true, composed: true }));

// A tile names a place ("kitchen", "climate"); routes say where that is on this
// dashboard: a view path, or tab:<id> for the surrounding nice-tabs. With routes set,
// anything unrouted stays put rather than opening a page that does not exist.
export function go(el, routes, basePath, place) {
  if (!place) return;
  const to = routes ? routes[place] : place;
  if (!to) return;
  if (to.startsWith("tab:")) return askTab(el, to.slice(4));
  navigate(basePath, to, "home");
}

export const dashboardPath = (basePath) => String(basePath || window.location.pathname).replace(/^\/+/, "").split("/")[0] || "lovelace";
