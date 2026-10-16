// Words and numbers. The card side of nice/format.jinja.

export const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n; };
// No reading: missing, unknown or unavailable
export const quiet = (st) => st == null || st === "" || st === "unknown" || st === "unavailable";
export const sentence = (s) => { const t = String(s || "").trim().toLowerCase().replace(/[.!]+$/, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
// "power_off" reads "Power off"; a state that is already cased ("Party") is left alone
export const words = (st) => { const t = String(st); return /_/.test(t) || t === t.toLowerCase() ? sentence(t.replace(/_/g, " ")) : t; };
export const power = (w) => (w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`);
export const isToday = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

// "4 min", "3 hr", "2 d"; null under a minute
export function span(iso) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? null : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} hr` : `${Math.floor(m / 1440)} d`;
}
// "7:24 AM" today, "Tue 7:24 AM" before that
export function when(iso) {
  const d = new Date(iso), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isToday(iso) ? t : `${d.toLocaleDateString([], { weekday: "short" })} ${t}`;
}
// "17:30" as the viewer's clock writes it
export function clock(hm) {
  const [h, m] = String(hm).split(":").map(Number), d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
// A timestamp from now: "In 42 min", "3 hr ago"
export function fromNow(iso) {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "—";
  const mins = Math.round((at - Date.now()) / 60000), m = Math.abs(mins), ahead = mins > 0;
  if (m < 1) return "Now";
  const s = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hr` : m < 10080 ? `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"}` : null;
  if (!s) return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return ahead ? `In ${s}` : `${s} ago`;
}
// How long ago something last changed: "Just now", "12 min ago", "Since Tue"
export function ago(isoChanged) {
  const mins = Math.round((Date.now() - new Date(isoChanged).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
  return `Since ${new Date(isoChanged).toLocaleDateString(undefined, { weekday: "short" })}`;
}
// A duration in whatever unit the sensor uses
export function duration(v, unit) {
  const mins = v * ({ ms: 1 / 60000, s: 1 / 60, min: 1, h: 60, d: 1440 }[unit] ?? 1);
  if (mins < 1) return `${Math.round(mins * 60)} s`;
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60), rest = Math.round(mins % 60);
  if (h < 24) return rest ? `${h} hr ${rest} min` : `${h} hr`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} hr` : `${d} d`;
}
