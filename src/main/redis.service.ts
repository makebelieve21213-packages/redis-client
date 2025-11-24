import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from "@nestjs/common";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { RedisClientModuleOptions } from "src/types/module-options.interface";
import type RedisClientContract from "src/types/redis.interface";

// Предоставляет единый экземпляр Redis подключения для всего приложения
@Injectable()
export default class RedisClientService
	implements RedisClientContract, OnModuleInit, OnModuleDestroy
{
	private static instance: Redis | null = null;

	constructor(
		@Inject(REDIS_CLIENT_OPTIONS)
		private readonly options: RedisClientModuleOptions,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisClientService.name);
	}

	// Инициализация единственного экземпляра Redis клиента при старте модуля
	async onModuleInit(): Promise<void> {
		if (!RedisClientService.instance) {
			this.logger.log("Инициализация Redis клиента...");

			RedisClientService.instance = new Redis({
				host: this.options.host,
				port: this.options.port,
				password: this.options.password,
				db: this.options.db ?? 0,
				lazyConnect: true,
				...this.options.options,
			});

			// Подписка на события
			RedisClientService.instance.on("connect", () => {
				this.logger.log("Redis подключен");
			});

			RedisClientService.instance.on("error", (error: Error) => {
				this.logger.error("Redis ошибка подключения", error.stack ?? "");
			});

			RedisClientService.instance.on("close", () => {
				this.logger.warn("Redis подключение закрыто");
			});

			try {
				await RedisClientService.instance.connect();
				this.logger.log("Redis успешно подключен");
			} catch (error) {
				throw new RedisClientError("Не удалось подключиться к Redis", error, this.logger);
			}
		}
	}

	// Очистка при остановке модуля
	async onModuleDestroy(): Promise<void> {
		await this.disconnect();
	}

	// Получить единственный экземпляр Redis клиента
	getClient(): Redis {
		if (!RedisClientService.instance) {
			throw new RedisClientError(
				"Redis клиент не инициализирован",
				new Error("Redis клиент не инициализирован"),
				this.logger
			);
		}
		return RedisClientService.instance;
	}

	// Получить значение по ключу
	async get(key: string): Promise<string | null> {
		try {
			return await this.getClient().get(key);
		} catch (error) {
			// Если ошибка уже RedisClientError, пробрасываем её дальше
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка получения ключа ${key}`, error, this.logger);
		}
	}

	// Установить значение по ключу с опциональным TTL
	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		try {
			// Проверяем инициализацию клиента (getClient выбросит ошибку если не инициализирован)
			const client = this.getClient();

			// Проверяем подключение перед операцией
			if (!this.isConnected()) {
				throw new RedisClientError(
					`Redis не подключен. Статус: ${client.status ?? "null"}`,
					new Error("Redis connection not ready"),
					this.logger
				);
			}

			if (ttlSeconds !== undefined && ttlSeconds > 0) {
				await client.setex(key, ttlSeconds, value);
			} else {
				await client.set(key, value);
			}
		} catch (error) {
			// Если ошибка уже RedisClientError, пробрасываем её дальше
			if (error instanceof RedisClientError) {
				throw error;
			}

			// Логируем детали ошибки для диагностики
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			this.logger.error(
				`Ошибка установки ключа ${key}. Размер значения: ${value.length} байт. Ошибка: ${errorMessage}`,
				errorStack
			);

			throw new RedisClientError(`Ошибка установки ключа ${key}`, error, this.logger);
		}
	}

	// Удалить ключ
	async del(key: string): Promise<number> {
		try {
			return await this.getClient().del(key);
		} catch (error) {
			// Если ошибка уже RedisClientError, пробрасываем её дальше
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка удаления ключа ${key}`, error, this.logger);
		}
	}

	// Получить TTL ключа в секундах
	async ttl(key: string): Promise<number> {
		try {
			return await this.getClient().ttl(key);
		} catch (error) {
			// Если ошибка уже RedisClientError, пробрасываем её дальше
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка получения TTL ключа ${key}`, error, this.logger);
		}
	}

	// Сформировать ключ с userId
	makeUserKey(userId: string, key: string): string {
		return `user:${userId}:${key}`;
	}

	// Проверить подключение к Redis
	isConnected(): boolean {
		if (!RedisClientService.instance) {
			return false;
		}
		const status = RedisClientService.instance.status;
		// Проверяем, что статус "ready" - клиент подключен и готов к работе
		return status === "ready";
	}

	// Отключиться от Redis
	async disconnect(): Promise<void> {
		if (RedisClientService.instance) {
			this.logger.log("Отключение от Redis...");
			await RedisClientService.instance.quit();
			RedisClientService.instance = null;
			this.logger.log("Redis отключен");
		}
	}

	// Hash методы

	// Установить поле в Hash
	async hset(key: string, field: string, value: string): Promise<number> {
		try {
			return await this.getClient().hset(key, field, value);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка установки поля ${field} в Hash ${key}`, error, this.logger);
		}
	}

	// Получить поле из Hash
	async hget(key: string, field: string): Promise<string | null> {
		try {
			return await this.getClient().hget(key, field);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка получения поля ${field} из Hash ${key}`, error, this.logger);
		}
	}

	// Получить все поля из Hash
	async hgetall(key: string): Promise<Record<string, string>> {
		try {
			return await this.getClient().hgetall(key);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка получения всех полей из Hash ${key}`, error, this.logger);
		}
	}

	// Удалить поле из Hash
	async hdel(key: string, field: string): Promise<number> {
		try {
			return await this.getClient().hdel(key, field);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка удаления поля ${field} из Hash ${key}`, error, this.logger);
		}
	}

	// Проверить существование поля в Hash
	async hexists(key: string, field: string): Promise<number> {
		try {
			return await this.getClient().hexists(key, field);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка проверки существования поля ${field} в Hash ${key}`,
				error,
				this.logger
			);
		}
	}

	// Сканировать Hash
	async hscan(
		key: string,
		cursor: number,
		pattern?: string,
		count?: number
	): Promise<[string, string[]]> {
		try {
			const args: (string | number)[] = [key, cursor];
			if (pattern) {
				args.push("MATCH", pattern);
			}
			if (count) {
				args.push("COUNT", count);
			}
			return await this.getClient().hscan(...(args as Parameters<Redis["hscan"]>));
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка сканирования Hash ${key}`, error, this.logger);
		}
	}

	// Sorted Set методы

	// Добавить элемент в Sorted Set
	async zadd(key: string, score: number, member: string): Promise<number> {
		try {
			return await this.getClient().zadd(key, score, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка добавления элемента ${member} в Sorted Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Получить элементы по диапазону
	async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
		try {
			if (withScores) {
				return await this.getClient().zrange(key, start, stop, "WITHSCORES");
			}
			return await this.getClient().zrange(key, start, stop);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка получения элементов из Sorted Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Удалить элемент из Sorted Set
	async zrem(key: string, member: string): Promise<number> {
		try {
			return await this.getClient().zrem(key, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка удаления элемента ${member} из Sorted Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Удалить элементы по score диапазону
	async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
		try {
			return await this.getClient().zremrangebyscore(key, min, max);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка удаления элементов по score из Sorted Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Получить score элемента
	async zscore(key: string, member: string): Promise<string | null> {
		try {
			return await this.getClient().zscore(key, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка получения score элемента ${member} из Sorted Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Set методы

	// Добавить элемент в Set
	async sadd(key: string, member: string): Promise<number> {
		try {
			return await this.getClient().sadd(key, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка добавления элемента ${member} в Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Получить все элементы Set
	async smembers(key: string): Promise<string[]> {
		try {
			return await this.getClient().smembers(key);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка получения всех элементов из Set ${key}`, error, this.logger);
		}
	}

	// Удалить элемент из Set
	async srem(key: string, member: string): Promise<number> {
		try {
			return await this.getClient().srem(key, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка удаления элемента ${member} из Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Проверить существование элемента в Set
	async sismember(key: string, member: string): Promise<number> {
		try {
			return await this.getClient().sismember(key, member);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка проверки существования элемента ${member} в Set ${key}`,
				error,
				this.logger
			);
		}
	}

	// Redis Streams методы

	// Добавить запись в Stream
	async xadd(key: string, id: string, fields: Record<string, string>): Promise<string> {
		try {
			const args: (string | number)[] = [key, id];
			for (const [field, value] of Object.entries(fields)) {
				args.push(field, value);
			}
			const result = await this.getClient().xadd(...(args as Parameters<Redis["xadd"]>));
			if (!result) {
				throw new RedisClientError(
					`Не удалось добавить запись в Stream ${key}`,
					new Error("xadd вернул null"),
					this.logger
				);
			}
			return result;
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка добавления записи в Stream ${key}`, error, this.logger);
		}
	}

	// Прочитать записи из Stream
	async xread(
		streams: Array<{ key: string; id: string }>,
		count?: number
	): Promise<Array<{
		key: string;
		messages: Array<{ id: string; fields: Record<string, string> }>;
	}> | null> {
		try {
			const args: (string | number)[] = [];
			if (count !== undefined) {
				args.push("COUNT", count);
			}
			args.push("STREAMS");
			for (const stream of streams) {
				args.push(stream.key);
			}
			for (const stream of streams) {
				args.push(stream.id);
			}

			const result = await this.getClient().xread(...(args as Parameters<Redis["xread"]>));
			if (!result) {
				return null;
			}

			return result.map(([key, messages]) => ({
				key: key as string,
				messages: (messages as Array<[string, string[]]>).map(([id, fieldsArray]) => {
					const fields: Record<string, string> = {};
					for (let i = 0; i < fieldsArray.length; i += 2) {
						fields[fieldsArray[i] as string] = fieldsArray[i + 1] as string;
					}
					return { id, fields };
				}),
			}));
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка чтения записей из Stream`, error, this.logger);
		}
	}

	// Обрезать Stream до maxlen
	async xtrim(key: string, maxlen: number): Promise<number> {
		try {
			return await this.getClient().xtrim(key, "MAXLEN", "~", maxlen);
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка обрезки Stream ${key}`, error, this.logger);
		}
	}

	// Очистка методы

	// Сканировать ключи по паттерну
	async scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]> {
		try {
			const args: (string | number)[] = [cursor];
			if (pattern) {
				args.push("MATCH", pattern);
			}
			if (count !== undefined) {
				args.push("COUNT", count);
			}
			return await this.getClient().scan(...(args as Parameters<Redis["scan"]>));
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка сканирования ключей`, error, this.logger);
		}
	}

	// Очистить старые ключи по паттерну
	async cleanupOldKeys(pattern: string, maxAgeSeconds: number): Promise<number> {
		try {
			let deletedCount = 0;
			let cursor = 0;

			do {
				const [nextCursor, keys] = await this.scan(cursor, pattern, 100);
				cursor = parseInt(nextCursor, 10);

				for (const key of keys) {
					const ttl = await this.ttl(key);
					if (ttl === -1) {
						// Ключ без TTL, проверяем время последнего доступа через OBJECT IDLETIME
						const idleTime = (await this.getClient().object("IDLETIME", key)) as number;
						if (idleTime > maxAgeSeconds) {
							await this.del(key);
							deletedCount++;
						}
					} else if (ttl > maxAgeSeconds) {
						// Ключ с TTL, но еще не истек, удаляем принудительно
						await this.del(key);
						deletedCount++;
					}
				}
			} while (cursor !== 0);

			return deletedCount;
		} catch (error) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(
				`Ошибка очистки старых ключей по паттерну ${pattern}`,
				error,
				this.logger
			);
		}
	}
}
