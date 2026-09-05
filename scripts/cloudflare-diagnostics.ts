// Preloaded only by the deployment command. Never log headers, query strings,
// request/response bodies, or resource identifiers: they can contain secrets.
const originalFetch = globalThis.fetch;

const diagnosticFetch: typeof fetch = Object.assign(
  async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const response = await originalFetch(input, init);
    if (url.hostname === "api.cloudflare.com") {
      const path = url.pathname.replace(
        /\/(accounts|zones|stores|secrets|namespaces|scripts)\/[^/]+/g,
        "/$1/:id",
      );
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      console.info(`[cloudflare] ${method} ${path} -> ${response.status}`);
    }
    return response;
  },
  originalFetch,
);

globalThis.fetch = diagnosticFetch;
