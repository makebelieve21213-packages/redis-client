import { LoggerService } from "@makebelieve21213-packages/logger";
import RedisClientError from "src/errors/redis.error";

// Мокируем @makebelieve21213-packages/logger
jest.mock("@makebelieve21213-packages/logger", () => ({
	LoggerService: class MockLoggerService {
		log = jest.fn();
		error = jest.fn();
		warn = jest.fn();
		debug = jest.fn();
		verbose = jest.fn();
		setContext = jest.fn();
	},
}));

describe("RedisClientError", () => {
	const serviceName = "TestService";
	const errorMessage = "Test error message";
	let mockLogger: LoggerService;

	beforeEach(() => {
		mockLogger = new LoggerService({ serviceName });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create error with correct name", () => {
			const error = new RedisClientError(errorMessage, new Error(), mockLogger);

			expect(error.name).toBe("RedisClientError");
		});

		it("should create error with correct message", () => {
			const error = new RedisClientError(errorMessage, new Error(), mockLogger);

			expect(error.message).toBe(errorMessage);
		});

		it("should preserve stack trace from original Error", () => {
			const originalError = new Error("Original error");
			const originalStack = originalError.stack;

			const error = new RedisClientError(errorMessage, originalError, mockLogger);

			expect(error.stack).toBe(originalStack);
		});

		it("should handle original Error without stack", () => {
			const originalError = new Error("Original error");
			delete originalError.stack;

			const error = new RedisClientError(errorMessage, originalError, mockLogger);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(errorMessage);
		});

		it("should handle non-Error original error", () => {
			const originalError = "string error";

			const error = new RedisClientError(errorMessage, originalError, mockLogger);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(errorMessage);
		});

		it("should handle null as original error", () => {
			const error = new RedisClientError(errorMessage, null, mockLogger);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(errorMessage);
		});

		it("should handle undefined as original error", () => {
			const error = new RedisClientError(errorMessage, undefined, mockLogger);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(errorMessage);
		});
	});

	describe("getOriginalError", () => {
		it("should return original Error object", () => {
			const originalError = new Error("Original error");
			const error = new RedisClientError(errorMessage, originalError, mockLogger);

			expect(error.getOriginalError()).toBe(originalError);
		});

		it("should return original non-Error object", () => {
			const originalError = "string error";
			const error = new RedisClientError(errorMessage, originalError, mockLogger);

			expect(error.getOriginalError()).toBe(originalError);
		});

		it("should return null if original error is null", () => {
			const error = new RedisClientError(errorMessage, null, mockLogger);

			expect(error.getOriginalError()).toBeNull();
		});

		it("should return undefined if original error is undefined", () => {
			const error = new RedisClientError(errorMessage, undefined, mockLogger);

			expect(error.getOriginalError()).toBeUndefined();
		});
	});

	describe("inheritance", () => {
		it("should be instance of Error", () => {
			const error = new RedisClientError(errorMessage, new Error(), mockLogger);

			expect(error).toBeInstanceOf(Error);
		});

		it("should be instance of RedisClientError", () => {
			const error = new RedisClientError(errorMessage, new Error(), mockLogger);

			expect(error).toBeInstanceOf(RedisClientError);
		});

		it("should be throwable", () => {
			expect(() => {
				throw new RedisClientError(errorMessage, new Error(), mockLogger);
			}).toThrow(RedisClientError);
		});

		it("should be catchable as Error", () => {
			try {
				throw new RedisClientError(errorMessage, new Error(), mockLogger);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect(error).toBeInstanceOf(RedisClientError);
			}
		});
	});

	describe("error message formatting", () => {
		it("should handle complex error messages", () => {
			const complexMessage = "Failed to connect to Redis at localhost:6379";
			const error = new RedisClientError(complexMessage, new Error(), mockLogger);

			expect(error.message).toBe(complexMessage);
		});

		it("should handle empty error message", () => {
			const error = new RedisClientError("", new Error(), mockLogger);

			expect(error.message).toBe("");
		});

		it("should handle multiline error messages", () => {
			const multilineMessage = "Line 1\nLine 2\nLine 3";
			const error = new RedisClientError(multilineMessage, new Error(), mockLogger);

			expect(error.message).toBe(multilineMessage);
		});

		it("should handle unicode characters in message", () => {
			const unicodeMessage = "Ошибка подключения к Redis 🔴";
			const error = new RedisClientError(unicodeMessage, new Error(), mockLogger);

			expect(error.message).toBe(unicodeMessage);
		});
	});
});
