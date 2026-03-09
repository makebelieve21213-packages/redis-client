import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable } from "@nestjs/common";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { wrapRedisErrorAsync } from "src/utils/redis-error.helper";

// Сервис управления установкой значений
@Injectable()
export default class RedisSetService {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisSetService.name);
	}

	async sadd(key: string, member: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().sadd(key, member),
			`Ошибка добавления элемента ${member} в Set ${key}`,
			this.logger
		);
	}

	async smembers(key: string): Promise<string[]> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().smembers(key),
			`Ошибка получения всех элементов из Set ${key}`,
			this.logger
		);
	}

	async srem(key: string, member: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().srem(key, member),
			`Ошибка удаления элемента ${member} из Set ${key}`,
			this.logger
		);
	}

	async sismember(key: string, member: string): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().sismember(key, member),
			`Ошибка проверки существования элемента ${member} в Set ${key}`,
			this.logger
		);
	}
}
