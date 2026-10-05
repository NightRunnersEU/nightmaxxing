import { Duration } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { deploymentForHost } from "../config";
import { cookieOptions, readCookie, SESSION_COOKIE, sessionTokenFrom } from "./cookies";

const devScope = {
  apiOrigin: "http://api.nightmaxxing.localhost:8788",
  cookieDomain: ".nightmaxxing.localhost",
  secure: false,
  wwwOrigin: "http://nightmaxxing.localhost:3002",
};

const prodScope = {
  apiOrigin: "https://api.maxxing.nrght.eu",
  cookieDomain: ".maxxing.nrght.eu",
  secure: true,
  wwwOrigin: "https://maxxing.nrght.eu",
};

describe("deploymentForHost", () => {
  it.each([
    "api.nightmaxxing.localhost:8788",
    "api.nightmaxxing.localhost",
    "localhost:8788",
    "localhost",
    "127.0.0.1:61234",
  ])("treats %s as local dev", (host) => {
    expect(deploymentForHost(host)).toEqual(devScope);
  });

  it.each(["api.maxxing.nrght.eu", "api.maxxing.nrght.eu:443", "evil.localhost.example", ""])(
    "defaults %j to the secure production scope",
    (host) => {
      expect(deploymentForHost(host)).toEqual(prodScope);
    },
  );
});

describe("cookieOptions", () => {
  it("scopes to the parent domain with HttpOnly, Lax and Secure in production", () => {
    expect(cookieOptions(prodScope, 60)).toEqual({
      domain: ".maxxing.nrght.eu",
      httpOnly: true,
      maxAge: Duration.seconds(60),
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("omits Secure for plain-http local dev", () => {
    expect(cookieOptions(devScope, 600)).toMatchObject({
      domain: ".nightmaxxing.localhost",
      httpOnly: true,
      secure: false,
    });
  });

  it("clears a cookie with a zero max age", () => {
    expect(cookieOptions(prodScope, 0).maxAge).toEqual(Duration.seconds(0));
  });
});

describe("sessionTokenFrom", () => {
  function request(headers: Record<string, string>) {
    return HttpServerRequest.fromWeb(new Request("https://api.maxxing.nrght.eu/me", { headers }));
  }

  it("reads the bearer token first", () => {
    expect(
      sessionTokenFrom(request({ authorization: "Bearer abc", cookie: "tmx_session=cookie" })),
    ).toBe("abc");
  });

  it("falls back to the session cookie", () => {
    expect(sessionTokenFrom(request({ cookie: "other=1; tmx_session=cookie" }))).toBe("cookie");
  });

  it("ignores non-bearer authorization schemes", () => {
    expect(sessionTokenFrom(request({ authorization: "Basic abc" }))).toBeNull();
  });

  it("returns null without credentials", () => {
    expect(sessionTokenFrom(request({}))).toBeNull();
    expect(readCookie(request({ cookie: "other=1" }), SESSION_COOKIE)).toBeNull();
  });
});
