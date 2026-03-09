import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { wrapRedisErrorAsync } from "src/utils/redis-error.helper";

// Сервис управления ключами
@Injectable()
export default class RedisKeyService {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisKeyService.name);
	}

	async get(key: string): Promise<string | null> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().get(key),
			`Ошибка получения ключа ${key}`,
			this.logger
		);
	}

	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		try {
			const client = this.connection.getClient();

			if (!this.connection.isConnected()) {
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
			if (error instanceof RedisClientError) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			this.logger.error(
				`Ошибка установки ключа ${key}. Размер значения: ${value.length} байт. Ошибка: ${errorMessage}`,
				errorStack
			);
			throw new RedisClientError(`Ошибка установки ключа ${key}`, error, this.logger);
		}
	}

	async del(key: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().del(key),
			`Ошибка удаления ключа ${key}`,
			this.logger
		);
	}

	async ttl(key: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().ttl(key),
			`Ошибка получения TTL ключа ${key}`,
			this.logger
		);
	}

	makeUserKey(userId: string, key: string): string {
		return `user:${userId}:${key}`;
	}

	async scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]> {
		return wrapRedisErrorAsync(
			async () => {
				const args: (string | number)[] = [cursor];
				if (pattern) args.push("MATCH", pattern);
				if (count !== undefined) args.push("COUNT", count);
				return await this.connection.getClient().scan(...(args as Parameters<Redis["scan"]>));
			},
			"Ошибка сканирования ключей",
			this.logger
		);
	}

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
						const idleTime = (await this.connection.getClient().object("IDLETIME", key)) as number;
						if (idleTime > maxAgeSeconds) {
							await this.del(key);
							deletedCount++;
						}
					} else if (ttl > maxAgeSeconds) {
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
