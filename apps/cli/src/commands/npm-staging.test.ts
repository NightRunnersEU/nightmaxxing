import type { Dirent } from "node:fs";

import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  isNpmStagingDirName,
  npmScopeDirsForPaths,
  type NpmStagingFs,
  removeNpmStagingDirs,
} from "./npm-staging";

const prefix = "C:\\Users\\Zoë O'Neil\\AppData\\Roaming\\npm";
const scope = `${prefix}\\node_modules\\@nightrunners`;
const liveExe = `${scope}\\nightmaxxing\\bin\\nightmaxxing.exe`;

type Entry = { kind: "dir" | "file" | "link"; name: string };

// A Windows filesystem: directory listings, the files that exist, the
// staging dirs with a running exe, and the ones whose delete fails (always,
// or the first few times, the way a handle antivirus holds goes away).
function fakeFs(options: {
  dirs: Record<string, Entry[]>;
  files?: string[];
  readdirFails?: boolean;
  rmFails?: string[];
  rmFailsTimes?: Record<string, number>;
  running?: string[];
}) {
  const calls = {
    exists: [] as string[],
    readdir: [] as string[],
    rm: [] as string[],
    sleep: [] as number[],
  };
  const rmFailuresLeft = new Map(Object.entries(options.rmFailsTimes ?? {}));
  const fs: NpmStagingFs = {
    exists: async (path) => {
      calls.exists.push(path);
      return options.files?.includes(path) ?? false;
    },
    hasRunningExe: async (dir) => options.running?.includes(dir) ?? false,
    readdir: async (path) => {
      calls.readdir.push(path);
      const entries = options.dirs[path];
      if (options.readdirFails || entries === undefined) {
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
      }
      return entries.map(
        (entry) =>
          ({
            isDirectory: () => entry.kind === "dir",
            name: entry.name,
          }) as Dirent,
      );
    },
    rm: async (path) => {
      calls.rm.push(path);
      const failuresLeft = rmFailuresLeft.get(path) ?? 0;
      if (failuresLeft > 0) {
        rmFailuresLeft.set(path, failuresLeft - 1);
      }
      if (options.rmFails?.includes(path) || failuresLeft > 0) {
        throw Object.assign(new Error(`EPERM: operation not permitted, unlink '${path}'`), {
          code: "EPERM",
        });
      }
    },
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
  };
  return { calls, fs };
}

describe("isNpmStagingDirName", () => {
  it("matches npm's retire name for the package dir", () => {
    // Seen on Windows 11 after `nightmaxxing upgrade`.
    expect(isNpmStagingDirName(".nightmaxxing-9vyC6HBb")).toBe(true);
    expect(isNpmStagingDirName(".nightmaxxing-FkQlRMWz")).toBe(true);
    expect(isNpmStagingDirName(".nightmaxxing-00000000")).toBe(true);
  });

  it("never matches the live package dirs or anything else", () => {
    for (const name of [
      "nightmaxxing",
      "nightmaxxing-windows-arm64",
      "nightmaxxing-9vyC6HBb",
      ".nightmaxxing",
      ".nightmaxxing-",
      ".nightmaxxing-9vyC6HB",
      ".nightmaxxing-9vyC6HBbX",
      ".nightmaxxing-9vyC+HBb",
      ".nightmaxxing-windows-arm64",
      ".nightmaxxing-windows-arm64-9vyC6HBb",
      ".Nightmaxxing-9vyC6HBb",
      ".nightmaxxing-9vyC6HBb\\bin",
      ".other-9vyC6HBb",
      ".bin",
    ]) {
      expect(isNpmStagingDirName(name), name).toBe(false);
    }
  });
});

describe("npmScopeDirsForPaths", () => {
  it("finds the scope dir from npm's shim in the prefix and from the running exe", () => {
    expect(npmScopeDirsForPaths([`${prefix}\\nightmaxxing.cmd`])).toEqual([scope]);
    expect(npmScopeDirsForPaths([liveExe])).toEqual([scope]);
    expect(
      npmScopeDirsForPaths([
        `${scope}\\nightmaxxing\\node_modules\\@nightrunners\\nightmaxxing-windows-arm64\\bin\\nightmaxxing.exe`,
      ]),
    ).toEqual([scope]);
    expect(
      npmScopeDirsForPaths(["C:/tmx/npm/node_modules/@nightrunners/nightmaxxing/bin/x.exe"]),
    ).toEqual(["C:\\tmx\\npm\\node_modules\\@nightrunners"]);
  });

  it("lists each scope dir once, whatever the casing", () => {
    expect(
      npmScopeDirsForPaths([
        `${prefix}\\nightmaxxing.ps1`,
        liveExe,
        liveExe.toUpperCase(),
        `${prefix}\\NIGHTMAXXING.CMD`,
      ]),
    ).toEqual([scope]);
  });

  it("does not take a sibling package for the CLI's own dir", () => {
    expect(
      npmScopeDirsForPaths([`${scope}\\nightmaxxing-windows-arm64\\bin\\nightmaxxing.exe`]),
    ).toEqual([`${scope}\\nightmaxxing-windows-arm64\\bin\\node_modules\\@nightrunners`]);
  });

  it("skips missing and relative paths", () => {
    expect(npmScopeDirsForPaths([undefined, null, "", "nightmaxxing.cmd", "bin\\x.exe"])).toEqual(
      [],
    );
  });
});

describe("removeNpmStagingDirs", () => {
  const live = [`${scope}\\nightmaxxing\\package.json`];

  it("removes only npm's staging dirs next to the live package", async () => {
    const { calls, fs } = fakeFs({
      dirs: {
        [scope]: [
          { kind: "dir", name: ".nightmaxxing-9vyC6HBb" },
          { kind: "dir", name: "nightmaxxing" },
          { kind: "dir", name: "nightmaxxing-windows-arm64" },
          { kind: "dir", name: ".nightmaxxing-windows-arm64" },
          { kind: "file", name: ".nightmaxxing-AbCdEf12" },
          // A junction or symlink is never followed or removed.
          { kind: "link", name: ".nightmaxxing-Zz9Yy8Xx" },
          { kind: "dir", name: ".nightmaxxing-pth6Tsaq" },
        ],
      },
      files: live,
    });

    const cleanup = await Effect.runPromise(
      removeNpmStagingDirs([`${prefix}\\nightmaxxing.cmd`, liveExe], "win32", fs),
    );

    expect(cleanup).toEqual({
      failed: [],
      inUse: [],
      removed: [`${scope}\\.nightmaxxing-9vyC6HBb`, `${scope}\\.nightmaxxing-pth6Tsaq`],
    });
    expect(calls.rm).toEqual(cleanup.removed);
    expect(calls.readdir).toEqual([scope]);
  });

  it("leaves a staging dir whose exe is still running whole, for a later run", async () => {
    // The upgrade that just ran from it, or one whose npm is still installing
    // (npm moves it back if the install fails).
    const running = `${scope}\\.nightmaxxing-9vyC6HBb`;
    const { calls, fs } = fakeFs({
      dirs: {
        [scope]: [
          { kind: "dir", name: ".nightmaxxing-9vyC6HBb" },
          { kind: "dir", name: ".nightmaxxing-pth6Tsaq" },
        ],
      },
      files: live,
      running: [running],
    });

    const cleanup = await Effect.runPromise(removeNpmStagingDirs([liveExe], "win32", fs));

    expect(cleanup).toEqual({
      failed: [],
      inUse: [running],
      removed: [`${scope}\\.nightmaxxing-pth6Tsaq`],
    });
    expect(calls.rm).toEqual([`${scope}\\.nightmaxxing-pth6Tsaq`]);
  });

  it("reports a staging dir it could not delete and carries on", async () => {
    const stuck = `${scope}\\.nightmaxxing-9vyC6HBb`;
    const { calls, fs } = fakeFs({
      dirs: {
        [scope]: [
          { kind: "dir", name: ".nightmaxxing-9vyC6HBb" },
          { kind: "dir", name: ".nightmaxxing-pth6Tsaq" },
        ],
      },
      files: live,
      rmFails: [stuck],
    });

    const cleanup = await Effect.runPromise(removeNpmStagingDirs([liveExe], "win32", fs));

    expect(cleanup).toEqual({
      failed: [stuck],
      inUse: [],
      removed: [`${scope}\\.nightmaxxing-pth6Tsaq`],
    });
    // Five attempts over about 2 s, then it is left for a later run.
    expect(calls.rm.filter((path) => path === stuck)).toHaveLength(5);
    expect(calls.sleep).toEqual([100, 250, 500, 1000]);
  });

  it("retries a delete that antivirus holds up for a moment", async () => {
    const staging = `${scope}\\.nightmaxxing-9vyC6HBb`;
    const { calls, fs } = fakeFs({
      dirs: { [scope]: [{ kind: "dir", name: ".nightmaxxing-9vyC6HBb" }] },
      files: live,
      rmFailsTimes: { [staging]: 2 },
    });

    const cleanup = await Effect.runPromise(removeNpmStagingDirs([liveExe], "win32", fs));

    expect(cleanup).toEqual({ failed: [], inUse: [], removed: [staging] });
    expect(calls.rm).toEqual([staging, staging, staging]);
    expect(calls.sleep).toHaveLength(2);
  });

  it("never touches a dir that holds no npm install of the CLI", async () => {
    const bunBin = "C:\\Users\\tmx\\.bun\\bin";
    const runner = "C:\\Users\\tmx\\.config\\nightmaxxing\\service-runners\\0.7.0";
    const { calls, fs } = fakeFs({
      dirs: {
        [`${bunBin}\\node_modules\\@nightrunners`]: [
          { kind: "dir", name: ".nightmaxxing-9vyC6HBb" },
        ],
        [`${runner}\\node_modules\\@nightrunners`]: [
          { kind: "dir", name: ".nightmaxxing-9vyC6HBb" },
        ],
      },
    });

    const cleanup = await Effect.runPromise(
      removeNpmStagingDirs(
        [`${bunBin}\\nightmaxxing.exe`, `${runner}\\nightmaxxing.exe`],
        "win32",
        fs,
      ),
    );

    expect(cleanup).toEqual({ failed: [], inUse: [], removed: [] });
    expect(calls.readdir).toEqual([]);
    expect(calls.rm).toEqual([]);
  });

  it("does nothing outside Windows", async () => {
    const { calls, fs } = fakeFs({
      dirs: { [scope]: [{ kind: "dir", name: ".nightmaxxing-9vyC6HBb" }] },
      files: live,
    });

    for (const platform of ["darwin", "linux"] as const) {
      const cleanup = await Effect.runPromise(removeNpmStagingDirs([liveExe], platform, fs));
      expect(cleanup).toEqual({ failed: [], inUse: [], removed: [] });
    }
    expect(calls).toEqual({ exists: [], readdir: [], rm: [], sleep: [] });
  });

  it("never fails", async () => {
    const unreadable = fakeFs({ dirs: {}, files: live, readdirFails: true });
    expect(
      await Effect.runPromise(removeNpmStagingDirs([liveExe], "win32", unreadable.fs)),
    ).toEqual({ failed: [], inUse: [], removed: [] });

    const throwing: NpmStagingFs = {
      exists: async () => {
        throw new Error("boom");
      },
      hasRunningExe: async () => false,
      readdir: async () => [],
      rm: async () => {},
      sleep: async () => {},
    };
    expect(await Effect.runPromise(removeNpmStagingDirs([liveExe], "win32", throwing))).toEqual({
      failed: [],
      inUse: [],
      removed: [],
    });
  });
});
