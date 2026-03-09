import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { wrapRedisErrorAsync } from "src/utils/redis-error.helper";

// Сервис управления хешированием
@Injectable()
export default class RedisHashService {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisHashService.name);
	}

	async hset(key: string, field: string, value: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().hset(key, field, value),
			`Ошибка установки поля ${field} в Hash ${key}`,
			this.logger
		);
	}

	async hget(key: string, field: string): Promise<string | null> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().hget(key, field),
			`Ошибка получения поля ${field} из Hash ${key}`,
			this.logger
		);
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().hgetall(key),
			`Ошибка получения всех полей из Hash ${key}`,
			this.logger
		);
	}

	async hdel(key: string, field: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().hdel(key, field),
			`Ошибка удаления поля ${field} из Hash ${key}`,
			this.logger
		);
	}

	async hexists(key: string, field: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().hexists(key, field),
			`Ошибка проверки существования поля ${field} в Hash ${key}`,
			this.logger
		);
	}

	async hscan(
		key: string,
		cursor: number,
		pattern?: string,
		count?: number
	): Promise<[string, string[]]> {
		return wrapRedisErrorAsync(
			async () => {
				const args: (string | number)[] = [key, cursor];
				if (pattern) args.push("MATCH", pattern);
				if (count) args.push("COUNT", count);
				return await this.connection.getClient().hscan(...(args as Parameters<Redis["hscan"]>));
			},
			`Ошибка сканирования Hash ${key}`,
			this.logger
		);
	}
}
