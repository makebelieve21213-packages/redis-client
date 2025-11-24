import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import RedisClientError from "src/errors/redis.error";

import type { LoggerService } from "@makebelieve21213-packages/logger";
import type { INestApplicationContext } from "@nestjs/common";
import type { Cluster } from "ioredis";
import type { ServerOptions } from "socket.io";
import type RedisClientService from "src/main/redis.service";
import type { RedisSocketIoAdapterOptions } from "src/types/socket-io-adapter.interface";

/**
 * Универсальный Socket.IO адаптер с поддержкой Redis для масштабирования
 * Использует RedisClientService для создания pub/sub клиентов
 */
export default class RedisSocketIoAdapter extends IoAdapter {
	private adapterConstructor: ReturnType<typeof createAdapter> | undefined;
	private redisInitialized = false;

	constructor(
		readonly app: INestApplicationContext,
		private readonly redisClientService: RedisClientService,
		private readonly logger: LoggerService,
		private readonly options: RedisSocketIoAdapterOptions = {}
	) {
		super(app);

		this.logger.setContext(RedisSocketIoAdapter.name);
		this.options = {
			maxRetries: this.options?.maxRetries ?? 10,
			retryDelay: this.options?.retryDelay ?? 100,
			...this.options,
		};
	}

	/**
	 * Ленивая инициализация Redis адаптера для Socket.IO с retry logic
	 * Вызывается при создании Socket.IO сервера, ждет подключения Redis
	 */
	private async initializeRedisAdapter(): Promise<void> {
		// Если уже пытались инициализировать - не повторяем
		if (this.redisInitialized) {
			return;
		}

		this.redisInitialized = true;

		try {
			// Ждем подключения Redis с retry
			const maxRetries = this.options.maxRetries ?? 10;
			const retryDelay = this.options.retryDelay ?? 100;
			let retries = 0;

			while (!this.redisClientService.isConnected() && retries < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
				retries++;
			}

			// Проверяем, что Redis подключен после retry
			if (!this.redisClientService.isConnected()) {
				this.logger.warn(
					"Redis connection timeout, Socket.IO will work without Redis adapter (single instance mode)"
				);
				return;
			}

			// Получаем ioredis клиент из нашего сервиса
			const pubClient = this.redisClientService.getClient();

			// Создаем дубликат для subscriber
			const subClient = pubClient.duplicate();
			await subClient.connect();

			/**
			 * Создаем адаптер Socket.IO с ioredis клиентами
			 * @socket.io/redis-adapter поддерживает ioredis
			 */
			this.adapterConstructor = createAdapter(
				pubClient as unknown as Cluster,
				subClient as unknown as Cluster
			);

			this.logger.log("Redis adapter for Socket.IO successfully initialized");
		} catch (error: Error | unknown) {
			// Используем RedisClientError для автоматического логирования
			new RedisClientError("Failed to initialize Redis adapter for Socket.IO", error, this.logger);
			// Продолжаем работу без Redis адаптера (для локальной разработки)
		}
	}

	/**
	 * Создание Socket.IO сервера с настройками CORS и Redis адаптером
	 * Автоматически вызывается NestJS при инициализации WebSocket gateway
	 */
	createIOServer(port: number, options?: ServerOptions): ReturnType<IoAdapter["createIOServer"]> {
		// Объединяем настройки из опций с переданными опциями
		const serverOptions: ServerOptions = {
			...this.options.socketOptions,
			...options,
			cors: this.options.cors
				? {
						origin: this.options.cors.origin,
						credentials: this.options.cors.credentials ?? false,
						methods: this.options.cors.methods,
						allowedHeaders: this.options.cors.allowedHeaders,
					}
				: options?.cors,
		} as ServerOptions;

		const server = super.createIOServer(port, serverOptions);

		// Ленивая инициализация Redis адаптера (когда Redis уже подключен)
		void this.initializeRedisAdapter().then(() => {
			// Подключаем Redis адаптер, если он был инициализирован
			if (this.adapterConstructor) {
				server.adapter(this.adapterConstructor);
				this.logger.log("Redis adapter attached to Socket.IO server");
			}
		});

		if (this.options.cors) {
			const origin = Array.isArray(this.options.cors.origin)
				? this.options.cors.origin.join(", ")
				: this.options.cors.origin;
			this.logger.log(`Socket.IO server created with CORS origin: ${origin}`);
		} else {
			this.logger.log("Socket.IO server created");
		}

		return server;
	}
}
