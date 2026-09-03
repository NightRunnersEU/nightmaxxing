import { describe, expect, it } from "vitest";

import { createMainPackageJson } from "./publish-manifest";
import { npmDistTagForVersion, parsePublishCliArgs } from "./publish-options";
import { npmRegistryPackageVersionUrl } from "./publish-registry";

describe("publish script dist tags", () => {
  it("uses latest for stable versions and the prerelease identifier otherwise", () => {
    expect(npmDistTagForVersion("0.4.18")).toBe("latest");
    expect(npmDistTagForVersion("0.4.18-alpha.0")).toBe("alpha");
    expect(npmDistTagForVersion("0.4.18-beta.2")).toBe("beta");
    expect(npmDistTagForVersion("0.4.18-rc.1")).toBe("rc");
  });

  it("parses an explicit npm dist-tag override", () => {
    expect(
      parsePublishCliArgs(["--dry-run", "--tag", "alpha", "--out-dir", ".tmp/publish"]),
    ).toEqual({
      dryRun: true,
      outDir: ".tmp/publish",
      tag: "alpha",
    });
  });
});

describe("publish script generated main package", () => {
  it("publishes a native CLI installer package with new target optional dependencies", () => {
    const manifest = createMainPackageJson();

    expect(manifest.bin).toEqual({ nightmaxxing: "./bin/nightmaxxing.exe" });
    // npm links Windows shims after preinstall and before postinstall; using
    // postinstall here makes those shims run Node against the final native exe.
    expect(manifest.scripts).toEqual({
      preinstall: "bun ./install-native.mjs || node ./install-native.mjs",
    });
    expect(manifest.scripts).not.toHaveProperty("postinstall");
    expect(manifest.files).toEqual([
      "bin",
      "native-bin-launcher.cjs",
      "install-native.mjs",
      "README.md",
      "LICENSE",
    ]);
    expect(manifest.optionalDependencies).toHaveProperty("@nightrunners/nightmaxxing-darwin-arm64");
    expect(Object.keys(manifest.optionalDependencies)).not.toContain(
      "@nightrunners/nightmaxxing-service-darwin-arm64",
    );
  });
});

describe("publish script registry checks", () => {
  it("uses public package version endpoints for scoped packages", () => {
    expect(
      npmRegistryPackageVersionUrl("@nightrunners/nightmaxxing-darwin-arm64", "0.4.18-alpha.4"),
    ).toBe("https://registry.npmjs.org/@nightrunners%2Fnightmaxxing-darwin-arm64/0.4.18-alpha.4");
  });

  it("escapes version build metadata in registry URLs", () => {
    expect(
      npmRegistryPackageVersionUrl("@nightrunners/nightmaxxing", "1.0.0-alpha.1+build.2"),
    ).toBe("https://registry.npmjs.org/@nightrunners%2Fnightmaxxing/1.0.0-alpha.1%2Bbuild.2");
  });
});
