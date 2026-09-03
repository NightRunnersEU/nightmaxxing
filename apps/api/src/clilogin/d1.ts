import {
  cliLoginRequests,
  cliTokens,
  devices,
  usageDays,
  usageSourceStats,
  users,
} from "@nightmaxxing/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Layer } from "effect";
import { Option } from "effect";

import { Drizzle } from "../database";
import { CliLoginRepository } from "./service";

const makeD1CliLoginRepository = Effect.fn("makeD1CliLoginRepository")(function* () {
  const database = yield* Drizzle;

  return CliLoginRepository.of({
    insertRequest: (input) =>
      Effect.gen(function* () {
        yield* database.use((db) =>
          db.insert(cliLoginRequests).values({
            id: input.id,
            code: input.code,
            status: "pending",
            deviceArch: input.deviceArch ?? null,
            deviceId: input.deviceId,
            deviceName: input.deviceName,
            devicePlatform: input.devicePlatform,
            deviceVersion: input.deviceVersion ?? null,
            expiresAt: input.expiresAt,
            createdAt: new Date(),
          }),
        );
      }),
    findRequest: (code) =>
      Effect.gen(function* () {
        const rows = yield* database.use((db) =>
          db.select().from(cliLoginRequests).where(eq(cliLoginRequests.code, code)).limit(1),
        );
        const row = rows[0];

        return row === undefined ? Option.none() : Option.some(row);
      }),
    deleteRequest: (id) =>
      Effect.gen(function* () {
        yield* database.use((db) => db.delete(cliLoginRequests).where(eq(cliLoginRequests.id, id)));
      }),
    findRequestUser: (userId) =>
      Effect.gen(function* () {
        const rows = yield* database.use((db) =>
          db.select().from(users).where(eq(users.id, userId)).limit(1),
        );
        const row = rows[0];

        return row === undefined
          ? Option.none()
          : Option.some({ avatarUrl: row.avatarUrl, id: row.id, login: row.login, name: row.name });
      }),
    approveRequest: (input) =>
      Effect.gen(function* () {
        const now = new Date();
        yield* database.use((db) =>
          db.batch([
            db
              .insert(devices)
              .values({
                arch: input.deviceArch,
                id: input.deviceId,
                userId: input.userId,
                name: input.deviceName,
                platform: input.devicePlatform,
                version: input.deviceVersion,
                createdAt: now,
              })
              .onConflictDoUpdate({
                target: devices.id,
                set: {
                  arch: input.deviceArch,
                  userId: input.userId,
                  name: input.deviceName,
                  platform: input.devicePlatform,
                  version: input.deviceVersion,
                },
              }),
            // Account switch on a shared machine: history follows the
            // device so the totals never double-count across users.
            db
              .update(usageDays)
              .set({ userId: input.userId })
              .where(eq(usageDays.deviceId, input.deviceId)),
            db
              .update(usageSourceStats)
              .set({ userId: input.userId })
              .where(eq(usageSourceStats.deviceId, input.deviceId)),
            db.insert(cliTokens).values({
              id: input.tokenId,
              tokenHash: input.tokenHash,
              userId: input.userId,
              deviceId: input.deviceId,
              name: input.deviceName,
              createdAt: now,
            }),
            db
              .update(cliLoginRequests)
              .set({ status: "approved", token: input.rawToken, userId: input.userId })
              .where(eq(cliLoginRequests.id, input.requestId)),
          ]),
        );
      }),
  });
});

const CliLoginRepositoryLive = Layer.effect(CliLoginRepository, makeD1CliLoginRepository());

export { CliLoginRepositoryLive };
