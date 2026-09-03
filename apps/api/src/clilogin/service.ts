import { Context } from "effect";
import { Effect } from "effect";
import { Option } from "effect";

import { LoginCodeExpired, LoginCodeNotFound } from "@nightmaxxing/api-contract";
import type { CliLoginRequest } from "@nightmaxxing/db";

import type { DatabaseError } from "../database";
import {
  generateCliToken,
  generateLoginCode,
  hashCliToken,
  normalizeLoginCode,
} from "../auth/crypto";
import type { CurrentUser } from "../auth/service";

/**
 * The device-code login flow: the CLI starts a request and polls its code;
 * a signed-in browser approves it, which registers the device and mints a
 * never-expiring CLI token. The raw token is parked on the request row
 * between approve and poll and the row is deleted on delivery — each code
 * hands out its token exactly once.
 */

const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 2;

interface StartInput {
  deviceArch?: string | undefined;
  deviceId: string;
  deviceName: string;
  devicePlatform: string;
  deviceVersion?: string | undefined;
}

interface StartResult {
  code: string;
  expiresAt: string;
  intervalSeconds: number;
  verificationUri: string;
}

type PollResult = { status: "pending" } | { status: "complete"; token: string; user: CurrentUser };

interface CliLoginServiceShape {
  /** wwwOrigin derives from the request host (see cookieScopeFor) so dev
   * and prod mint the right verification URL from one deploy. */
  start(input: StartInput, wwwOrigin: string): Effect.Effect<StartResult, never, any>;
  poll(code: string): Effect.Effect<PollResult, LoginCodeExpired | LoginCodeNotFound, any>;
  approve(
    user: CurrentUser,
    code: string,
  ): Effect.Effect<{ deviceName: string }, LoginCodeExpired | LoginCodeNotFound, any>;
}

interface CliLoginRepositoryShape {
  insertRequest(input: {
    code: string;
    deviceArch?: string | undefined;
    deviceId: string;
    deviceName: string;
    devicePlatform: string;
    deviceVersion?: string | undefined;
    expiresAt: Date;
    id: string;
  }): Effect.Effect<void, DatabaseError, any>;
  findRequest(code: string): Effect.Effect<Option.Option<CliLoginRequest>, DatabaseError, any>;
  deleteRequest(id: string): Effect.Effect<void, DatabaseError, any>;
  findRequestUser(userId: string): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  /**
   * One batch: upsert the device to the approving user, re-home the
   * device's historical usage rows (account switch on a shared machine),
   * insert the hashed CLI token, and park the raw token on the request row.
   */
  approveRequest(input: {
    deviceArch: string | null;
    deviceId: string;
    deviceName: string;
    devicePlatform: string;
    deviceVersion: string | null;
    rawToken: string;
    requestId: string;
    tokenHash: string;
    tokenId: string;
    userId: string;
  }): Effect.Effect<void, DatabaseError, any>;
}

class CliLoginService extends Context.Service<CliLoginService, CliLoginServiceShape>()(
  "@nightmaxxing/api/CliLoginService",
) {}

class CliLoginRepository extends Context.Service<CliLoginRepository, CliLoginRepositoryShape>()(
  "@nightmaxxing/api/CliLoginRepository",
) {}

const makeCliLoginService = Effect.fn("makeCliLoginService")(function* () {
  const repository = yield* CliLoginRepository;

  const loadActiveRequest = Effect.fn("CliLoginService.loadActiveRequest")(function* (
    rawCode: string,
  ) {
    const code = normalizeLoginCode(rawCode);
    const request = yield* repository.findRequest(code).pipe(Effect.orDie);
    if (Option.isNone(request)) {
      return yield* Effect.fail(new LoginCodeNotFound({ code }));
    }
    if (request.value.expiresAt.getTime() < Date.now()) {
      yield* repository.deleteRequest(request.value.id).pipe(Effect.orDie);
      return yield* Effect.fail(new LoginCodeExpired({ code }));
    }

    return request.value;
  });

  return CliLoginService.of({
    start: Effect.fn("CliLoginService.start")(function* (input, wwwOrigin) {
      const code = generateLoginCode();
      const expiresAt = new Date(Date.now() + LOGIN_REQUEST_TTL_MS);
      yield* repository
        .insertRequest({
          code,
          deviceArch: input.deviceArch,
          deviceId: input.deviceId,
          deviceName: input.deviceName,
          devicePlatform: input.devicePlatform,
          deviceVersion: input.deviceVersion,
          expiresAt,
          id: crypto.randomUUID(),
        })
        .pipe(Effect.orDie);

      return {
        code,
        expiresAt: expiresAt.toISOString(),
        intervalSeconds: POLL_INTERVAL_SECONDS,
        verificationUri: cliLoginVerificationUri(wwwOrigin, code),
      };
    }),
    poll: Effect.fn("CliLoginService.poll")(function* (rawCode) {
      const request = yield* loadActiveRequest(rawCode);
      if (request.status !== "approved" || request.token === null || request.userId === null) {
        return { status: "pending" } as const;
      }

      const user = yield* repository.findRequestUser(request.userId).pipe(Effect.orDie);
      if (Option.isNone(user)) {
        return yield* Effect.fail(new LoginCodeNotFound({ code: request.code }));
      }

      yield* repository.deleteRequest(request.id).pipe(Effect.orDie);

      return { status: "complete", token: request.token, user: user.value } as const;
    }),
    approve: Effect.fn("CliLoginService.approve")(function* (user, rawCode) {
      const request = yield* loadActiveRequest(rawCode);
      if (request.status === "approved") {
        // Repeated approve (double click, refreshed tab): keep the first
        // token instead of minting a second one.
        return { deviceName: request.deviceName };
      }

      const rawToken = generateCliToken();
      const tokenHash = yield* hashCliToken(rawToken);
      yield* repository
        .approveRequest({
          deviceArch: request.deviceArch,
          deviceId: request.deviceId,
          deviceName: request.deviceName,
          devicePlatform: request.devicePlatform,
          deviceVersion: request.deviceVersion,
          rawToken,
          requestId: request.id,
          tokenHash,
          tokenId: crypto.randomUUID(),
          userId: user.id,
        })
        .pipe(Effect.orDie);

      return { deviceName: request.deviceName };
    }),
  });
});

function cliLoginVerificationUri(wwwOrigin: string, code: string): string {
  return `${wwwOrigin}/login/cli?code=${encodeURIComponent(code)}`;
}

export { CliLoginRepository, CliLoginService, cliLoginVerificationUri, makeCliLoginService };

export type { CliLoginRepositoryShape };
