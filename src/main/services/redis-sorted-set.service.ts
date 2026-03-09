import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable } from "@nestjs/common";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { wrapRedisErrorAsync } from "src/utils/redis-error.helper";

// Сервис управления сортированными значениями
@Injectable()
export default class RedisSortedSetService {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisSortedSetService.name);
	}

	async zadd(key: string, score: number, member: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().zadd(key, score, member),
			`Ошибка добавления элемента ${member} в Sorted Set ${key}`,
			this.logger
		);
	}

	async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
		return wrapRedisErrorAsync(
			() => {
				if (withScores) {
					return this.connection.getClient().zrange(key, start, stop, "WITHSCORES");
				}
				return this.connection.getClient().zrange(key, start, stop);
			},
			`Ошибка получения элементов из Sorted Set ${key}`,
			this.logger
		);
	}

	async zrem(key: string, member: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().zrem(key, member),
			`Ошибка удаления элемента ${member} из Sorted Set ${key}`,
			this.logger
		);
	}

	async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().zremrangebyscore(key, min, max),
			`Ошибка удаления элементов по score из Sorted Set ${key}`,
			this.logger
		);
	}

	async zscore(key: string, member: string): Promise<string | null> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().zscore(key, member),
			`Ошибка получения score элемента ${member} из Sorted Set ${key}`,
			this.logger
		);
	}
}
