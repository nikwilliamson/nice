// Hearth shell — loaded with the House dashboard (a dashboard resource), so it runs for everyone on arrival.
//  1. Loads the Hearth fonts everywhere, not only inside dashboard cards; the theme does the rest of the styling.
//  2. Hides the sidebar. Users in ALWAYS_HIDDEN get it hidden on every load; everyone else once per device,
//     so pinning it back in their profile sticks. The ☰ button in each page's Hearth nav opens it.
//  3. Hides Home Assistant's top bar on the dashboards in OWN_CHROME, where each page has its own Hearth nav.
//     In edit mode the top bar comes back so editing still works.

const ALWAYS_HIDDEN = ["person.kat"];
const ONCE_KEY = "hearth-sidebar-hidden-once";
const OWN_CHROME = ["house-hub"];

if (!document.getElementById("hearth-fonts")) {
  const link = document.createElement("link");
  link.id = "hearth-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,0..100,0..1&family=Outfit:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

function hideSidebar(tries = 0) {
  const ha = document.querySelector("home-assistant");
  const hass = ha?.hass;
  if (!hass?.user) {
    if (tries < 60) setTimeout(() => hideSidebar(tries + 1), 500);
    return;
  }
  const me = ALWAYS_HIDDEN.some((id) => hass.states[id]?.attributes.user_id === hass.user.id);
  let once = false;
  try { once = !localStorage.getItem(ONCE_KEY); } catch (e) { /* storage blocked: leave the sidebar alone */ }
  if (!me && !once) return;
  if (hass.dockedSidebar !== "always_hidden") {
    ha.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: "always_hidden" }, bubbles: true, composed: true }));
  }
  try { localStorage.setItem(ONCE_KEY, "1"); } catch (e) { /* ignore */ }
}
hideSidebar();

// Top bar: checked on every navigation and a few times a second, since Home Assistant redraws it freely
function topBar() {
  try {
    const main = document.querySelector("home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
    const root = main?.shadowRoot?.querySelector("ha-panel-lovelace")?.shadowRoot?.querySelector("hui-root");
    if (!root?.shadowRoot) return;
    const hide = OWN_CHROME.includes(location.pathname.split("/")[1]) && !root.lovelace?.editMode && !/[?&]edit=1/.test(location.search);
    let style = root.shadowRoot.getElementById("hearth-chrome");
    if (hide && !style) {
      style = document.createElement("style");
      style.id = "hearth-chrome";
      style.textContent = ".header { display: none !important; } #view { padding-top: env(safe-area-inset-top, 0px) !important; }";
      root.shadowRoot.appendChild(style);
      root.style.setProperty("--header-height", "0px");
    } else if (!hide && style) {
      style.remove();
      root.style.removeProperty("--header-height");
    }
  } catch (e) { /* the page is mid-render; try again on the next tick */ }
}
window.addEventListener("location-changed", () => setTimeout(topBar, 0));
setInterval(topBar, 400);
