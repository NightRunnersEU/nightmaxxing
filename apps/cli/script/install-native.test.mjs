import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { binaryName, nativePackageNames } from "./install-native.mjs";
import launcher from "./native-bin-launcher.cjs";
import {
  serviceRunnerPackageName,
  serviceRunnerTargetCandidates,
} from "../src/service-runner-targets";

const { findNativeBinary, recoveryMessage } = launcher;

describe("native preinstall package selection", () => {
  it("matches service runner candidate ordering", () => {
    for (const options of [
      { arch: "x64", avx2: true, musl: false, platform: "linux" },
      { arch: "x64", avx2: false, musl: false, platform: "linux" },
      { arch: "x64", avx2: true, musl: true, platform: "linux" },
      { arch: "x64", avx2: false, musl: true, platform: "linux" },
      { arch: "arm64", musl: false, platform: "linux" },
      { arch: "arm64", musl: true, platform: "linux" },
      { arch: "x64", avx2: true, platform: "darwin" },
      { arch: "x64", avx2: false, platform: "darwin" },
      { arch: "arm64", platform: "darwin" },
      { arch: "x64", avx2: true, platform: "win32" },
      { arch: "x64", avx2: false, platform: "win32" },
      { arch: "arm64", platform: "win32" },
    ]) {
      expect(nativePackageNames(options)).toEqual(
        serviceRunnerTargetCandidates({
          avx2: options.avx2,
          cpuArch: options.arch,
          libc: options.musl === undefined ? undefined : options.musl ? "musl" : "glibc",
          platform: options.platform,
        }).map((target) => serviceRunnerPackageName(target)),
      );
    }
  });

  it("orders linux glibc and musl x64 candidates with baseline fallback", () => {
    expect(nativePackageNames({ arch: "x64", avx2: true, musl: false, platform: "linux" })).toEqual(
      [
        "@nightrunners/nightmaxxing-linux-x64",
        "@nightrunners/nightmaxxing-linux-x64-baseline",
        "@nightrunners/nightmaxxing-linux-x64-musl",
        "@nightrunners/nightmaxxing-linux-x64-baseline-musl",
      ],
    );
    expect(nativePackageNames({ arch: "x64", avx2: false, musl: true, platform: "linux" })).toEqual(
      [
        "@nightrunners/nightmaxxing-linux-x64-baseline-musl",
        "@nightrunners/nightmaxxing-linux-x64-musl",
        "@nightrunners/nightmaxxing-linux-x64-baseline",
        "@nightrunners/nightmaxxing-linux-x64",
      ],
    );
  });

  it("orders darwin and windows native packages with arm64 exact matches", () => {
    expect(nativePackageNames({ arch: "x64", avx2: false, platform: "darwin" })).toEqual([
      "@nightrunners/nightmaxxing-darwin-x64-baseline",
      "@nightrunners/nightmaxxing-darwin-x64",
    ]);
    expect(nativePackageNames({ arch: "arm64", platform: "windows" })).toEqual([
      "@nightrunners/nightmaxxing-windows-arm64",
    ]);
  });

  it("uses native executable names inside target packages", () => {
    expect(binaryName("darwin")).toBe("nightmaxxing");
    expect(binaryName("linux")).toBe("nightmaxxing");
    expect(binaryName("windows")).toBe("nightmaxxing.exe");
  });

  it("fallback launcher resolves an installed optional native package", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "nightmaxxing-native-launcher-"));
    try {
      const packageName = "@nightrunners/nightmaxxing-darwin-arm64";
      const packageDir = path.join(
        temp,
        "node_modules",
        "@nightrunners",
        "nightmaxxing-darwin-arm64",
      );
      const binaryPath = path.join(packageDir, "bin", "nightmaxxing");
      fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
      fs.writeFileSync(
        path.join(packageDir, "package.json"),
        JSON.stringify({ name: packageName }),
      );
      fs.writeFileSync(binaryPath, "#!/bin/sh\nexit 0\n");

      expect(
        findNativeBinary({
          arch: "arm64",
          packageDir: temp,
          platform: "darwin",
        }),
      ).toEqual({
        packageName,
        path: fs.realpathSync(binaryPath),
      });
    } finally {
      fs.rmSync(temp, { force: true, recursive: true });
    }
  });

  it("fallback launcher recovery message explains shadowed and script-blocked installs", () => {
    const message = recoveryMessage({ arch: "arm64", platform: "darwin" });

    expect(message).toContain("which -a nightmaxxing");
    expect(message).toContain("bun add -g --trust @nightrunners/nightmaxxing");
    expect(message).toContain("bun remove -g @nightrunners/nightmaxxing");
    expect(message).toContain("npx -y @nightrunners/nightmaxxing@latest bootstrap");
  });
});
