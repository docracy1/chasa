// Proxies /api/* same-origin to the worker, so the browser sees the Pages host on both ends instead of
// a cross-site request to the API host. Without this, the session cookie set on login is
// a third-party cookie and gets blocked by default in Chrome/Safari — login "succeeds"
// server-side but the browser never keeps the cookie.
//
// redirect: "manual" is required so OAuth Connect (302 → Dropbox/Microsoft/Box) and
// magic-link verify (302 → /app/account) reach the browser instead of being followed
// inside the Pages Function.
export const onRequest: PagesFunction<{ WORKER_URL: string }> = async (context) => {
  const url = new URL(context.request.url);
  const workerBase = context.env.WORKER_URL || "https://api.chasa.io";
  const target = `${workerBase}${url.pathname}${url.search}`;

  // Tell the worker which host the browser is on so emailed links and redirects come back here,
  // rather than to whatever PUBLIC_APP_URL happens to be. set() overwrites any client-sent value.
  const headers = new Headers(context.request.headers);
  headers.set("X-Chasa-App-Origin", url.origin);

  const upstream = await fetch(
    new Request(target, {
      method: context.request.method,
      headers,
      body: context.request.body,
      redirect: "manual",
    })
  );

  // Opaque redirect responses from fetch({ redirect: "manual" }) — re-expose Location to the browser.
  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("Location");
    if (location) {
      const headers = new Headers(upstream.headers);
      headers.set("Location", location);
      return new Response(null, { status: upstream.status, headers });
    }
  }

  return upstream;
};
