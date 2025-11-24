import type { LoggerService } from "@makebelieve21213-packages/logger";

// Кастомная ошибка Redis клиента с автоматическим логированием
export default class RedisClientError extends Error {
	constructor(
		readonly message: string,
		private readonly originalError: unknown,
		private readonly logger: LoggerService
	) {
		super(message);
		this.name = "RedisClientError";
		this.logger.setContext(RedisClientError.name);

		// Сохраняем stack trace оригинальной ошибки
		if (this.originalError instanceof Error && this.originalError.stack) {
			this.stack = this.originalError.stack;
		}

		// Автоматическое логирование при создании ошибки
		this.logger.error(this.message, this.getErrorStack());
	}

	// Получить stack trace оригинальной ошибки или пустую строку
	private getErrorStack(): string {
		return this.originalError instanceof Error ? (this.originalError.stack ?? "") : "";
	}

	// Получить оригинальную ошибку для дальнейшей обработки
	getOriginalError(): unknown {
		return this.originalError;
	}
}
