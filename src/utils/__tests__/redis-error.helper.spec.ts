import { LoggerService } from "@makebelieve21213-packages/logger";
import RedisClientError from "src/errors/redis.error";
import { wrapRedisError, wrapRedisErrorAsync } from "src/utils/redis-error.helper";

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

describe("redis-error.helper", () => {
	let mockLogger: LoggerService;

	beforeEach(() => {
		mockLogger = new LoggerService({} as { serviceName: string });
	});

	describe("wrapRedisError", () => {
		it("should return result when operation succeeds", () => {
			const result = wrapRedisError(() => 42, "error msg", mockLogger);
			expect(result).toBe(42);
		});

		it("should return object result when operation succeeds", () => {
			const obj = { foo: "bar" };
			const result = wrapRedisError(() => obj, "error msg", mockLogger);
			expect(result).toEqual(obj);
		});

		it("should throw RedisClientError when operation throws Error", () => {
			const error = new Error("operation failed");
			expect(() =>
				wrapRedisError(
					() => {
						throw error;
					},
					"error msg",
					mockLogger
				)
			).toThrow(RedisClientError);
			expect(() =>
				wrapRedisError(
					() => {
						throw error;
					},
					"error msg",
					mockLogger
				)
			).toThrow("error msg");
		});

		it("should rethrow RedisClientError when operation throws RedisClientError", () => {
			const redisError = new RedisClientError("original", new Error("x"), mockLogger);
			expect(() =>
				wrapRedisError(
					() => {
						throw redisError;
					},
					"error msg",
					mockLogger
				)
			).toThrow(redisError);
		});

		it("should throw RedisClientError when operation throws non-Error", () => {
			expect(() =>
				wrapRedisError(
					() => {
						throw "string error";
					},
					"error msg",
					mockLogger
				)
			).toThrow(RedisClientError);
		});
	});

	describe("wrapRedisErrorAsync", () => {
		it("should return result when operation succeeds", async () => {
			const result = await wrapRedisErrorAsync(() => Promise.resolve(42), "error msg", mockLogger);
			expect(result).toBe(42);
		});

		it("should return object result when operation succeeds", async () => {
			const obj = { foo: "bar" };
			const result = await wrapRedisErrorAsync(() => Promise.resolve(obj), "error msg", mockLogger);
			expect(result).toEqual(obj);
		});

		it("should throw RedisClientError when operation rejects with Error", async () => {
			const error = new Error("operation failed");
			await expect(
				wrapRedisErrorAsync(() => Promise.reject(error), "error msg", mockLogger)
			).rejects.toThrow(RedisClientError);
			await expect(
				wrapRedisErrorAsync(() => Promise.reject(error), "error msg", mockLogger)
			).rejects.toThrow("error msg");
		});

		it("should rethrow RedisClientError when operation rejects with RedisClientError", async () => {
			const redisError = new RedisClientError("original", new Error("x"), mockLogger);
			await expect(
				wrapRedisErrorAsync(() => Promise.reject(redisError), "error msg", mockLogger)
			).rejects.toThrow(redisError);
		});

		it("should throw RedisClientError when operation rejects with non-Error", async () => {
			await expect(
				wrapRedisErrorAsync(() => Promise.reject("string error"), "error msg", mockLogger)
			).rejects.toThrow(RedisClientError);
		});
	});
});
