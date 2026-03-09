import { LoggerService } from "@makebelieve21213-packages/logger";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { wrapRedisErrorAsync } from "src/utils/redis-error.helper";

import type { RedisStreamReadResult } from "src/types/redis-stream.types";

// Серуис управения потоками
@Injectable()
export default class RedisStreamService {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly logger: LoggerService
	) {
		this.logger.setContext(RedisStreamService.name);
	}

	async xadd(key: string, id: string, fields: Record<string, string>): Promise<string> {
		try {
			const args: (string | number)[] = [key, id];
			for (const [field, value] of Object.entries(fields)) {
				args.push(field, value);
			}
			const result = await this.connection.getClient().xadd(...(args as Parameters<Redis["xadd"]>));
			if (!result) {
				throw new RedisClientError(
					`Не удалось добавить запись в Stream ${key}`,
					new Error("xadd вернул null"),
					this.logger
				);
			}
			return result;
		} catch (error: Error | unknown) {
			if (error instanceof RedisClientError) {
				throw error;
			}
			throw new RedisClientError(`Ошибка добавления записи в Stream ${key}`, error, this.logger);
		}
	}

	async xread(
		streams: Array<{ key: string; id: string }>,
		count?: number
	): Promise<RedisStreamReadResult[] | null> {
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

			const result = await this.connection.getClient().xread(...(args as Parameters<Redis["xread"]>));
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

	async xtrim(key: string, maxlen: number): Promise<number> {
		return wrapRedisErrorAsync(
			() => this.connection.getClient().xtrim(key, "MAXLEN", "~", maxlen),
			`Ошибка обрезки Stream ${key}`,
			this.logger
		);
	}
}
