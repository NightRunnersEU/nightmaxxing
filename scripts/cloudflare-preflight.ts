// Validate the exact credentials used by CI before Alchemy can retry an auth
// failure into a misleading rate-limit error. Never print credential values.
const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "";
const apiToken = process.env["CLOUDFLARE_API_TOKEN"] ?? "";

if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  console.error("::error::CLOUDFLARE_ACCOUNT_ID must contain only the 32-character account ID.");
  process.exit(1);
}

if (!apiToken || apiToken !== apiToken.trim() || /[\s"'=]/.test(apiToken)) {
  console.error(
    "::error::CLOUDFLARE_API_TOKEN must contain only the API token value, without quotes, whitespace, a Bearer prefix, or a variable assignment.",
  );
  process.exit(1);
}

const baseUrl = "https://api.cloudflare.com/client/v4";
const headers = { Authorization: `Bearer ${apiToken}` };

const check = async (path: string, label: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json()) as {
    success?: boolean;
    errors?: { code?: number }[];
    result?: { status?: string };
  };
  const codes = (body.errors ?? [])
    .map((error) => error.code)
    .filter((code) => typeof code === "number")
    .join(", ");
  console.info(`${label}: HTTP ${response.status}${codes ? ` (error codes: ${codes})` : ""}`);
  return { ok: response.ok && body.success === true, status: response.status, body };
};

try {
  const access = await check(
    `/accounts/${accountId}/workers/subdomain`,
    "Cloudflare Workers access",
  );
  if (!access.ok) {
    if (access.status === 401 || access.status === 403) {
      let verified = await check("/user/tokens/verify", "User API token verification");
      if (!verified.ok && verified.status !== 429) {
        verified = await check(
          `/accounts/${accountId}/tokens/verify`,
          "Account API token verification",
        );
      }
      console.error(
        verified.ok && verified.body.result?.status === "active"
          ? "::error::The token is active but cannot access Workers for CLOUDFLARE_ACCOUNT_ID. Check its account scope, Workers Scripts permission, and client-IP restrictions."
          : "::error::Cloudflare rejected the deployment credentials. Update the repository's CLOUDFLARE_API_TOKEN secret with a valid Cloudflare API token for the configured account.",
      );
    } else {
      console.error("::error::Cloudflare preflight failed. Deployment stopped without retrying.");
    }
    process.exit(1);
  }
} catch {
  console.error("::error::Cloudflare preflight could not read a response. Deployment stopped.");
  process.exit(1);
}
