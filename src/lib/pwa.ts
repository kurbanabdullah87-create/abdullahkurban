export async function initializeOffline() {
  if (!("serviceWorker" in navigator)) return;
  const h = location.hostname;
  const blocked =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some(
      (d) => h === d || h.endsWith("." + d),
    ) ||
    new URLSearchParams(location.search).get("sw") === "off";
  if (blocked) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((r) =>
          [r.active, r.installing, r.waiting].some(
            (w) => w && new URL(w.scriptURL).pathname === "/sw.js",
          ),
        )
        .map((r) => r.unregister()),
    );
    return;
  }
  const { Workbox } = await import("workbox-window");
  const wb = new Workbox("/sw.js");
  void wb.register();
}
