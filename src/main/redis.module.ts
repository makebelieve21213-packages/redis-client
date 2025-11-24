import { LoggerService } from "@makebelieve21213-packages/logger";
import { Module, Global, DynamicModule, Provider } from "@nestjs/common";
import RedisClientService from "src/main/redis.service";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";
import {
	RedisClientModuleOptions,
	RedisClientModuleAsyncOptions,
} from "src/types/module-options.interface";

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
			{
				provide: RedisClientService,
				useFactory: (
					moduleOptions: RedisClientModuleOptions,
					logger: LoggerService
				): RedisClientService => {
					// NestJS автоматически вызовет onModuleInit() - не нужно вызывать вручную
					return new RedisClientService(moduleOptions, logger);
				},
				inject: [REDIS_CLIENT_OPTIONS, LoggerService],
			},
		];

		return {
			module: RedisClientModule,
			imports: options.imports || [],
			providers,
			exports: [RedisClientService],
		};
	}
}
