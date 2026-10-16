// A card's own title row, with a status tag: a coloured dot and a few words.
import { html, css } from "lit";

// kind: ok | busy | warn | alert | locked | muted
export const statusTag = (kind, text, title = "") => html`<span class="tag ${kind}" title=${title}><i></i>${text}</span>`;

export const headStyles = css`
  :host { font-family: var(--n-body); container-type: inline-size; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: var(--n-s-md); margin: var(--n-s-sm) var(--n-s-2xs) var(--n-s-md); }
  .title { font-family: var(--n-display); font-weight: var(--n-title-weight); font-size: var(--n-title-size); letter-spacing: -0.01em; color: var(--primary-text-color, #1c2233); white-space: nowrap; }
  .tag { display: inline-flex; align-items: center; gap: var(--n-s-sm); min-width: 0; padding: var(--n-s-xs) var(--n-s-md) var(--n-s-xs) var(--n-s-sm); border-radius: var(--n-r-full); font-size: 0.8em; font-weight: 800;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--secondary-background-color, #eef0f5); color: var(--secondary-text-color, #6b7388); }
  .tag i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--n-muted); }
  .tag.ok i { background: var(--n-ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--n-ok) 22%, transparent); }
  .tag.busy i { background: var(--n-busy); box-shadow: 0 0 0 3px color-mix(in srgb, var(--n-busy) 22%, transparent); }
  .tag.warn i { background: var(--n-warn); }
  .tag.alert i { background: var(--n-alert); }
  .tag.locked i { background: var(--n-locked); }
`;
