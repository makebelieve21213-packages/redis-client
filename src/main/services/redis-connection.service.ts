import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from "@nestjs/common";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { RedisClientModuleOptions } from "src/types/module-options.interface";

// Сервис управления соединением
@Injectable()
export default class RedisConnectionService implements OnModuleInit, OnModuleDestroy {
	private static instance: Redis | null = null;

	constructor(
		@Inject(REDIS_CLIENT_OPTIONS)
		private readonly options: RedisClientModuleOptions,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisConnectionService.name);
	}

	async onModuleInit(): Promise<void> {
		if (!RedisConnectionService.instance) {
			this.logger.log("Инициализация Redis клиента...");

			RedisConnectionService.instance = new Redis({
				host: this.options.host,
				port: this.options.port,
				password: this.options.password,
				db: this.options.db ?? 0,
				lazyConnect: true,
				...this.options.options,
			});

			RedisConnectionService.instance.on("connect", () => {
				this.logger.log("Redis подключен");
			});

			RedisConnectionService.instance.on("error", (error: Error) => {
				this.logger.error("Redis ошибка подключения", error.stack ?? "");
			});

			RedisConnectionService.instance.on("close", () => {
				this.logger.warn("Redis подключение закрыто");
			});

			try {
				await RedisConnectionService.instance.connect();
				this.logger.log("Redis успешно подключен");
			} catch (error: Error | unknown) {
				throw new RedisClientError("Не удалось подключиться к Redis", error, this.logger);
			}
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.disconnect();
	}

	getClient(): Redis {
		if (!RedisConnectionService.instance) {
			throw new RedisClientError(
				"Redis клиент не инициализирован",
				new Error("Redis клиент не инициализирован"),
				this.logger
			);
		}
		return RedisConnectionService.instance;
	}

	isConnected(): boolean {
		if (!RedisConnectionService.instance) {
			return false;
		}
		return RedisConnectionService.instance.status === "ready";
	}

	async disconnect(): Promise<void> {
		if (RedisConnectionService.instance) {
			this.logger.log("Отключение от Redis...");
			await RedisConnectionService.instance.quit();
			RedisConnectionService.instance = null;
			this.logger.log("Redis отключен");
		}
	}

	static getInstance(): Redis | null {
		return RedisConnectionService.instance;
	}

	static resetInstance(): void {
		RedisConnectionService.instance = null;
	}
}
