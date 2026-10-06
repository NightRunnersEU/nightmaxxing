interface BrowserScreenshotOptions {
  gotoOptions?: {
    timeout?: number;
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  };
  screenshotOptions?: {
    clip?: {
      height: number;
      width: number;
      x: number;
      y: number;
    };
    omitBackground?: boolean;
    type?: "png";
  };
  selector?: string;
  setJavaScriptEnabled?: boolean;
  url: string;
  viewport?: {
    deviceScaleFactor?: number;
    height: number;
    width: number;
  };
  waitForSelector?: {
    selector: string;
    timeout?: number;
    visible?: true;
  };
}

interface OgBrowser {
  quickAction(action: "screenshot", options: BrowserScreenshotOptions): Promise<Response>;
}

interface OgR2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  key?: string;
  uploaded?: Date;
}

interface OgR2Bucket {
  get(key: string): Promise<OgR2Object | null>;
  list(options: { limit?: number; prefix: string }): Promise<{
    objects: Array<{ key: string; uploaded?: Date }>;
  }>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: {
        cacheControl?: string;
        contentType?: string;
      };
    },
  ): Promise<unknown>;
}

interface OgRuntimeEnv {
  BROWSER?: OgBrowser;
  BUCKET?: OgR2Bucket;
}

async function getOgRuntimeEnv(context?: unknown): Promise<OgRuntimeEnv> {
  const workerEnv = await getCloudflareWorkersEnv();
  return coerceOgRuntimeEnv(workerEnv) ?? coerceOgRuntimeEnv(context) ?? {};
}

async function getCloudflareWorkersEnv(): Promise<unknown> {
  try {
    const mod = (await import("cloudflare:workers")) as { env?: unknown };
    return mod.env;
  } catch {
    return undefined;
  }
}

function coerceOgRuntimeEnv(value: unknown): OgRuntimeEnv | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record,
    record["env"],
    record["bindings"],
    readPath(record, ["cloudflare", "env"]),
    readPath(record, ["platform", "env"]),
    readPath(record, ["runtime", "env"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const env = candidate as Record<string, unknown>;
    const maybeBrowser = env["BROWSER"];
    const maybeBucket = env["BUCKET"];
    if (maybeBrowser !== undefined || maybeBucket !== undefined) {
      return {
        BROWSER: isOgBrowser(maybeBrowser) ? maybeBrowser : undefined,
        BUCKET: isOgR2Bucket(maybeBucket) ? maybeBucket : undefined,
      };
    }
  }

  return null;
}

function readPath(value: Record<string, unknown>, path: readonly string[]): unknown {
  let cursor: unknown = value;
  for (const key of path) {
    if (typeof cursor !== "object" || cursor === null) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }

  return cursor;
}

function isOgBrowser(value: unknown): value is OgBrowser {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { quickAction?: unknown }).quickAction === "function"
  );
}

function isOgR2Bucket(value: unknown): value is OgR2Bucket {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { put?: unknown }).put === "function" &&
    typeof (value as { list?: unknown }).list === "function"
  );
}

export { coerceOgRuntimeEnv, getOgRuntimeEnv };

export type { BrowserScreenshotOptions, OgBrowser, OgR2Bucket, OgRuntimeEnv };
