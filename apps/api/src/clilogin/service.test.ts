import { describe, expect, it } from "vitest";

import { cliLoginVerificationUri } from "./service";

describe("cliLoginVerificationUri", () => {
  it("points CLI login requests at the canonical login route", () => {
    expect(cliLoginVerificationUri("https://nightmaxxing.example", "ABCD-1234")).toBe(
      "https://nightmaxxing.example/login/cli?code=ABCD-1234",
    );
  });

  it("encodes the login code query parameter", () => {
    expect(cliLoginVerificationUri("https://nightmaxxing.example", "ABCD 1234")).toBe(
      "https://nightmaxxing.example/login/cli?code=ABCD%201234",
    );
  });
});
