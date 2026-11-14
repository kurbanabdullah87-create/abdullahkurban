export async function initializeOffline() {
  if (!("serviceWorker" in navigator)) return;

  const host = location.hostname;
  const blocked =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some(
      (domain) => host === domain || host.endsWith("." + domain),
    ) ||
    new URLSearchParams(location.search).get("sw") === "off";

  if (blocked) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) =>
          [registration.active, registration.installing, registration.waiting].some(
            (worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js",
          ),
        )
        .map((registration) => registration.unregister()),
    );
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    // Check for a new worker when the app is opened, without blocking app startup.
    void registration.update().catch((error) => {
      console.warn("[PWA] Service worker update check failed", error);
    });
  } catch (error) {
    console.error("[PWA] Service worker registration failed", error);
  }
}
