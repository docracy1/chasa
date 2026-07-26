// Proxies /api/* same-origin to the worker, so the browser sees the Pages host on both ends instead of
// a cross-site request to the API host. Without this, the session cookie set on login is
// a third-party cookie and gets blocked by default in Chrome/Safari — login "succeeds"
// server-side but the browser never keeps the cookie.
export const onRequest: PagesFunction<{ WORKER_URL: string }> = async (context) => {
  const url = new URL(context.request.url);
  const workerBase = context.env.WORKER_URL || "https://api.chasa.io";
  const target = `${workerBase}${url.pathname}${url.search}`;
  return fetch(new Request(target, context.request));
};
