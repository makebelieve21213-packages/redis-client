import RedisClientError from "src/errors/redis.error";

import type { LoggerService } from "@makebelieve21213-packages/logger";

export function wrapRedisError<T>(operation: () => T, message: string, logger: LoggerService): T {
	try {
		return operation();
	} catch (error: Error | unknown) {
		if (error instanceof RedisClientError) {
			throw error;
		}
		throw new RedisClientError(message, error, logger);
	}
}

export async function wrapRedisErrorAsync<T>(
	operation: () => Promise<T>,
	message: string,
	logger: LoggerService
): Promise<T> {
	try {
		return await operation();
	} catch (error: Error | unknown) {
		if (error instanceof RedisClientError) {
			throw error;
		}
		throw new RedisClientError(message, error, logger);
	}
}
