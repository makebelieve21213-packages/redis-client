import { Module, Global, DynamicModule, Provider } from "@nestjs/common";
import RedisClientService from "src/main/redis.service";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisHashService from "src/main/services/redis-hash.service";
import RedisKeyService from "src/main/services/redis-key.service";
import RedisSetService from "src/main/services/redis-set.service";
import RedisSortedSetService from "src/main/services/redis-sorted-set.service";
import RedisStreamService from "src/main/services/redis-stream.service";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { RedisClientModuleAsyncOptions } from "src/types/module-options.interface";

const REDIS_SERVICES = [
	RedisConnectionService,
	RedisKeyService,
	RedisHashService,
	RedisSortedSetService,
	RedisSetService,
	RedisStreamService,
	RedisClientService,
];

// Глобальный модуль для единого подключения к Redis
@Global()
@Module({})
export default class RedisClientModule {
	// Регистрация модуля с динамическими опциями через useFactory
	static forRootAsync<T extends unknown[]>(
		options: RedisClientModuleAsyncOptions<T>
	): DynamicModule {
		const providers: Provider[] = [
			{
				provide: REDIS_CLIENT_OPTIONS,
				useFactory: options.useFactory,
				inject: options.inject || [],
			},
			...REDIS_SERVICES,
		];

		return {
			module: RedisClientModule,
			imports: options.imports || [],
			providers,
			exports: [RedisClientService],
		};
	}
}
