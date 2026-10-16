// ChartData: fetches what a card's charts need (each chart's data(viz)), keeps it for five
// minutes, and redraws the card when it arrives. Shared by every card that draws charts.
import { chart } from "../charts/index.js";

export class ChartData {
  constructor(host) { this.host = host; this.data = new Map(); }
  spec(viz) { return viz && chart(viz.type)?.data?.(viz); }
  // Ask for every viz in the list; anything new or stale is fetched
  want(vizzes) {
    for (const v of vizzes) {
      const spec = this.spec(v);
      if (!spec) continue;
      const have = this.data.get(spec.key);
      if (have && (have.loading || Date.now() - have.at < 300000)) continue;
      this.data.set(spec.key, { ...have, loading: true, at: have?.at || 0 });
      spec.load(this.host._real).then((value) => { this.data.set(spec.key, { at: Date.now(), value }); this.host.requestUpdate(); });
    }
  }
  of(viz) { const spec = this.spec(viz); return spec ? this.data.get(spec.key)?.value : undefined; }
}
