export { default as RedisClientModule } from "src/main/redis.module";
export { default as RedisClientService } from "src/main/redis.service";
export { default as RedisSocketIoAdapter } from "src/adapters/redis-socket-io.adapter";

export type { RedisClientModuleOptions } from "src/types/module-options.interface";
export type { RedisSocketIoAdapterOptions } from "src/types/socket-io-adapter.interface";
export type { RedisStreamMessage, RedisStreamReadResult } from "src/types/redis-stream.types";
