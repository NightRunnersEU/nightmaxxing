import { Context, Data, Effect } from "effect";
import { Layer } from "effect";

class RawUsageStorageError extends Data.TaggedError("RawUsageStorageError")<{
  readonly cause: unknown;
}> {}

interface R2BucketLike {
  put(
    key: string,
    value: string,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Effect.Effect<unknown, unknown, any>;
}

interface RawUsageObjectStoreShape {
  putObject(input: {
    key: string;
    payloadBytes: number;
    payloadHash: string;
    payloadJson: string;
  }): Effect.Effect<void, RawUsageStorageError, any>;
}

class RawUsageObjectStore extends Context.Service<RawUsageObjectStore, RawUsageObjectStoreShape>()(
  "@nightmaxxing/api/RawUsageObjectStore",
) {
  static layer(bucket: R2BucketLike): Layer.Layer<RawUsageObjectStore> {
    return Layer.succeed(
      RawUsageObjectStore,
      RawUsageObjectStore.of({
        putObject: ({ key, payloadBytes, payloadHash, payloadJson }) =>
          bucket
            .put(key, payloadJson, {
              customMetadata: {
                payloadBytes: String(payloadBytes),
                payloadHash,
              },
              httpMetadata: { contentType: "application/json" },
            })
            .pipe(
              Effect.asVoid,
              Effect.mapError((cause) => new RawUsageStorageError({ cause })),
            ),
      }),
    );
  }
}

export { RawUsageObjectStore, RawUsageStorageError };
