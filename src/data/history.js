// History and statistics for charts: one cache for every card on the page.
// Results are kept for five minutes, so ten redraws a minute cost one websocket call.
//
//   series(hass, entity, { hours | since: "midnight", points, smooth })  evenly spaced values
//   steps(hass, entity, { since })                                       the times a counter went up
//   daily(hass, entity, days)                                            one mean per day, today last
//   raw(hass, entity, startMs)                                           [{t, v}]

const KEEP = 300000;
const cache = new Map();

function remember(key, load) {
  const hit = cache.get(key);
  if (hit && (hit.pending || Date.now() - hit.at < KEEP)) return hit.pending || Promise.resolve(hit.data);
  const pending = load().then((data) => { cache.set(key, { at: Date.now(), data }); return data; })
    .catch(() => { cache.delete(key); return []; });
  cache.set(key, { at: 0, pending });
  return pending;
}

export const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function raw(hass, entity, startMs) {
  return remember(`h|${entity}|${Math.floor(startMs / KEEP)}`, () => hass.callWS({
    type: "history/history_during_period", start_time: new Date(startMs).toISOString(), entity_ids: [entity],
    minimal_response: true, no_attributes: true, significant_changes_only: false,
  }).then((r) => (r[entity] || []).map((p) => ({ t: (p.lu ?? p.lc) * 1000, v: parseFloat(p.s) })).filter((p) => !Number.isNaN(p.v))));
}

// Step-sample a history into n evenly spaced points, carrying the last value forward
export function bucket(rows, startMs, endMs, n) {
  const out = [];
  let i = 0, last = rows.length ? rows[0].v : 0;
  for (let k = 0; k < n; k++) {
    const t = startMs + ((endMs - startMs) * (k + 1)) / n;
    let sum = 0, cnt = 0;
    while (i < rows.length && rows[i].t <= t) { sum += rows[i].v; cnt++; last = rows[i].v; i++; }
    out.push(cnt ? sum / cnt : last);
  }
  return out;
}
// A three-point moving average: minute-level jitter reads as noise in a day-long line
export const smoothed = (v) => v.map((x, i) => (v[Math.max(0, i - 1)] + x + v[Math.min(v.length - 1, i + 1)]) / 3);

export async function series(hass, entity, { hours = 2, since = null, points = null, smooth = true } = {}) {
  const end = Date.now(), start = since === "midnight" ? midnight() : end - hours * 3600000;
  const n = points || Math.max(12, Math.min(96, Math.round((end - start) / 900000)));
  const vals = bucket(await raw(hass, entity, start), start, end, n);
  return smooth ? smoothed(vals) : vals;
}

// When a counter stepped up today, as hours of the day
export async function steps(hass, entity) {
  const start = midnight(), rows = await raw(hass, entity, start), out = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].v > rows[i - 1].v && rows[i].t >= start) { const d = new Date(rows[i].t); out.push({ h: d.getHours() + d.getMinutes() / 60, t: rows[i].t }); }
  }
  return out;
}

// One mean per day from long-term statistics, today last
export function daily(hass, entity, days = 14) {
  const start = new Date(midnight() - (days - 1) * 86400000);
  return remember(`d|${entity}|${days}|${start.getTime()}|${Math.floor(Date.now() / 3600000)}`, () => hass.callWS({
    type: "recorder/statistics_during_period", start_time: start.toISOString(), period: "day", statistic_ids: [entity], types: ["mean"],
  }).then((r) => (r[entity] || []).map((x) => ({ t: x.start, v: x.mean })).filter((x) => x.v != null)));
}
