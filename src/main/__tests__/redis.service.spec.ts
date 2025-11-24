import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisClientService from "src/main/redis.service";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { TestingModule } from "@nestjs/testing";
import type { RedisClientModuleOptions } from "src/types/module-options.interface";

// Мокируем ioredis
jest.mock("ioredis");

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

describe("RedisClientService", () => {
	let service: RedisClientService;
	let mockRedisInstance: jest.Mocked<Redis>;
	let mockLogger: LoggerService;

	const mockOptions: RedisClientModuleOptions = {
		host: "localhost",
		port: 6379,
		password: "test-password",
		db: 1,
	};

	beforeEach(async () => {
		mockLogger = new LoggerService({} as { serviceName: string });

		// Сброс статического экземпляра
		(RedisClientService as unknown as { instance: Redis | null }).instance = null;

		// Создаем мок Redis инстанса
		mockRedisInstance = {
			connect: jest.fn().mockResolvedValue(undefined),
			quit: jest.fn().mockResolvedValue("OK"),
			get: jest.fn() as jest.MockedFunction<Redis["get"]>,
			set: jest.fn() as jest.MockedFunction<Redis["set"]>,
			setex: jest.fn() as jest.MockedFunction<Redis["setex"]>,
			del: jest.fn() as jest.MockedFunction<Redis["del"]>,
			ttl: jest.fn() as jest.MockedFunction<Redis["ttl"]>,
			hset: jest.fn() as jest.MockedFunction<Redis["hset"]>,
			hget: jest.fn() as jest.MockedFunction<Redis["hget"]>,
			hgetall: jest.fn() as jest.MockedFunction<Redis["hgetall"]>,
			hdel: jest.fn() as jest.MockedFunction<Redis["hdel"]>,
			hexists: jest.fn() as jest.MockedFunction<Redis["hexists"]>,
			hscan: jest.fn() as jest.MockedFunction<Redis["hscan"]>,
			zadd: jest.fn() as jest.MockedFunction<Redis["zadd"]>,
			zrange: jest.fn() as jest.MockedFunction<Redis["zrange"]>,
			zrem: jest.fn() as jest.MockedFunction<Redis["zrem"]>,
			zremrangebyscore: jest.fn() as jest.MockedFunction<Redis["zremrangebyscore"]>,
			zscore: jest.fn() as jest.MockedFunction<Redis["zscore"]>,
			sadd: jest.fn() as jest.MockedFunction<Redis["sadd"]>,
			smembers: jest.fn() as jest.MockedFunction<Redis["smembers"]>,
			srem: jest.fn() as jest.MockedFunction<Redis["srem"]>,
			sismember: jest.fn() as jest.MockedFunction<Redis["sismember"]>,
			xadd: jest.fn() as jest.MockedFunction<Redis["xadd"]>,
			xread: jest.fn() as jest.MockedFunction<Redis["xread"]>,
			xtrim: jest.fn() as jest.MockedFunction<Redis["xtrim"]>,
			scan: jest.fn() as jest.MockedFunction<Redis["scan"]>,
			object: jest.fn() as jest.MockedFunction<Redis["object"]>,
			on: jest.fn() as jest.MockedFunction<Redis["on"]>,
			status: "ready",
		} as unknown as jest.Mocked<Redis>;

		// Мокируем конструктор Redis
		(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedisInstance);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: REDIS_CLIENT_OPTIONS,
					useValue: mockOptions,
				},
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
				RedisClientService,
			],
		}).compile();

		service = module.get<RedisClientService>(RedisClientService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		// Очищаем статический экземпляр после каждого теста
		(RedisClientService as unknown as { instance: Redis | null }).instance = null;
	});

	describe("onModuleInit", () => {
		it("should initialize Redis client on first call", async () => {
			await service.onModuleInit();

			expect(Redis).toHaveBeenCalledWith({
				host: mockOptions.host,
				port: mockOptions.port,
				password: mockOptions.password,
				db: mockOptions.db,
				lazyConnect: true,
			});
			expect(mockRedisInstance.on).toHaveBeenCalledWith("connect", expect.any(Function));
			expect(mockRedisInstance.on).toHaveBeenCalledWith("error", expect.any(Function));
			expect(mockRedisInstance.on).toHaveBeenCalledWith("close", expect.any(Function));
			expect(mockRedisInstance.connect).toHaveBeenCalled();
		});

		it("should not reinitialize if already initialized", async () => {
			await service.onModuleInit();
			jest.clearAllMocks();

			await service.onModuleInit();

			expect(Redis).not.toHaveBeenCalled();
			expect(mockRedisInstance.connect).not.toHaveBeenCalled();
		});

		it("should throw RedisClientError if connection fails", async () => {
			const error = new Error("Connection failed");
			mockRedisInstance.connect.mockRejectedValueOnce(error);

			await expect(service.onModuleInit()).rejects.toThrow(RedisClientError);

			// Сбрасываем instance перед вторым вызовом, так как при ошибке он все еще установлен
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;
			mockRedisInstance.connect.mockRejectedValueOnce(error);
			await expect(service.onModuleInit()).rejects.toThrow("Не удалось подключиться к Redis");
		});

		it("should handle connection with default db when db is not provided", async () => {
			const optionsWithoutDb: RedisClientModuleOptions = {
				host: "localhost",
				port: 6379,
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					{
						provide: REDIS_CLIENT_OPTIONS,
						useValue: optionsWithoutDb,
					},
					{
						provide: LoggerService,
						useValue: mockLogger,
					},
					RedisClientService,
				],
			}).compile();

			const serviceWithoutDb = module.get<RedisClientService>(RedisClientService);
			await serviceWithoutDb.onModuleInit();

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					db: 0,
				})
			);
		});

		it("should handle connection with additional options", async () => {
			const optionsWithExtras: RedisClientModuleOptions = {
				host: "localhost",
				port: 6379,
				options: {
					retryStrategy: () => 1000,
					connectTimeout: 10000,
				},
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					{
						provide: REDIS_CLIENT_OPTIONS,
						useValue: optionsWithExtras,
					},
					{
						provide: LoggerService,
						useValue: mockLogger,
					},
					RedisClientService,
				],
			}).compile();

			const serviceWithExtras = module.get<RedisClientService>(RedisClientService);
			await serviceWithExtras.onModuleInit();

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					retryStrategy: expect.any(Function),
					connectTimeout: 10000,
				})
			);
		});
	});

	describe("onModuleDestroy", () => {
		it("should disconnect on module destroy", async () => {
			await service.onModuleInit();
			await service.onModuleDestroy();

			expect(mockRedisInstance.quit).toHaveBeenCalled();
		});
	});

	describe("get", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		it("should get value by key", async () => {
			const key = "test-key";
			const value = "test-value";
			mockRedisInstance.get.mockResolvedValueOnce(value);

			const result = await service.get(key);

			expect(mockRedisInstance.get).toHaveBeenCalledWith(key);
			expect(result).toBe(value);
		});

		it("should return null if key does not exist", async () => {
			const key = "non-existent-key";
			mockRedisInstance.get.mockResolvedValueOnce(null);

			const result = await service.get(key);

			expect(result).toBeNull();
		});

		it("should throw RedisClientError if Redis throws", async () => {
			const key = "test-key";
			const error = new Error("Redis error");
			mockRedisInstance.get.mockRejectedValueOnce(error);

			await expect(service.get(key)).rejects.toThrow(RedisClientError);

			// Повторный вызов с новым mock
			mockRedisInstance.get.mockRejectedValueOnce(error);
			await expect(service.get(key)).rejects.toThrow(`Ошибка получения ключа ${key}`);
		});

		it("should throw RedisClientError if client is not initialized", async () => {
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;

			await expect(service.get("key")).rejects.toThrow(RedisClientError);

			// Сбрасываем instance перед вторым вызовом
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;
			await expect(service.get("key")).rejects.toThrow("Redis клиент не инициализирован");
		});
	});

	describe("set", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		it("should set value without TTL", async () => {
			const key = "test-key";
			const value = "test-value";
			mockRedisInstance.set.mockResolvedValueOnce("OK");

			await service.set(key, value);

			expect(mockRedisInstance.set).toHaveBeenCalledWith(key, value);
			expect(mockRedisInstance.setex).not.toHaveBeenCalled();
		});

		it("should set value with TTL", async () => {
			const key = "test-key";
			const value = "test-value";
			const ttl = 3600;
			mockRedisInstance.setex.mockResolvedValueOnce("OK");

			await service.set(key, value, ttl);

			expect(mockRedisInstance.setex).toHaveBeenCalledWith(key, ttl, value);
			expect(mockRedisInstance.set).not.toHaveBeenCalled();
		});

		it("should not use setex if TTL is 0", async () => {
			const key = "test-key";
			const value = "test-value";
			mockRedisInstance.set.mockResolvedValueOnce("OK");

			await service.set(key, value, 0);

			expect(mockRedisInstance.set).toHaveBeenCalledWith(key, value);
			expect(mockRedisInstance.setex).not.toHaveBeenCalled();
		});

		it("should not use setex if TTL is negative", async () => {
			const key = "test-key";
			const value = "test-value";
			mockRedisInstance.set.mockResolvedValueOnce("OK");

			await service.set(key, value, -1);

			expect(mockRedisInstance.set).toHaveBeenCalledWith(key, value);
			expect(mockRedisInstance.setex).not.toHaveBeenCalled();
		});

		it("should throw RedisClientError if Redis throws", async () => {
			const key = "test-key";
			const value = "test-value";
			const error = new Error("Redis error");
			mockRedisInstance.set.mockRejectedValueOnce(error);

			await expect(service.set(key, value)).rejects.toThrow(RedisClientError);

			// Повторный вызов с новым mock
			mockRedisInstance.set.mockRejectedValueOnce(error);
			await expect(service.set(key, value)).rejects.toThrow(`Ошибка установки ключа ${key}`);
		});

		it("should throw RedisClientError if client is not initialized", async () => {
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;

			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);

			// Сбрасываем instance перед вторым вызовом
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;
			await expect(service.set("key", "value")).rejects.toThrow("Redis клиент не инициализирован");
		});

		it("should throw RedisClientError if client is initialized but not connected", async () => {
			await service.onModuleInit();

			// Устанавливаем статус клиента в "connecting" вместо "ready"
			const instance = (RedisClientService as unknown as { instance: Redis | null }).instance;
			if (instance) {
				(instance as unknown as { status: string }).status = "connecting";
			}

			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
			await expect(service.set("key", "value")).rejects.toThrow(/Redis не подключен/);
		});

		it("should throw RedisClientError with null status when client status is null", async () => {
			await service.onModuleInit();

			// Устанавливаем статус клиента в null
			const instance = (RedisClientService as unknown as { instance: Redis | null }).instance;
			if (instance) {
				(instance as unknown as { status: string | null }).status = null;
			}

			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
			await expect(service.set("key", "value")).rejects.toThrow(/Redis не подключен.*Статус: null/);
		});
	});

	describe("del", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		it("should delete key and return count", async () => {
			const key = "test-key";
			mockRedisInstance.del.mockResolvedValueOnce(1);

			const result = await service.del(key);

			expect(mockRedisInstance.del).toHaveBeenCalledWith(key);
			expect(result).toBe(1);
		});

		it("should return 0 if key does not exist", async () => {
			const key = "non-existent-key";
			mockRedisInstance.del.mockResolvedValueOnce(0);

			const result = await service.del(key);

			expect(result).toBe(0);
		});

		it("should throw RedisClientError if Redis throws", async () => {
			const key = "test-key";
			const error = new Error("Redis error");
			mockRedisInstance.del.mockRejectedValueOnce(error);

			await expect(service.del(key)).rejects.toThrow(RedisClientError);

			// Повторный вызов с новым mock
			mockRedisInstance.del.mockRejectedValueOnce(error);
			await expect(service.del(key)).rejects.toThrow(`Ошибка удаления ключа ${key}`);
		});

		it("should throw RedisClientError if client is not initialized", async () => {
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;

			await expect(service.del("key")).rejects.toThrow(RedisClientError);

			// Сбрасываем instance перед вторым вызовом
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;
			await expect(service.del("key")).rejects.toThrow("Redis клиент не инициализирован");
		});
	});

	describe("ttl", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		it("should return TTL in seconds", async () => {
			const key = "test-key";
			const ttlValue = 3600;
			mockRedisInstance.ttl.mockResolvedValueOnce(ttlValue);

			const result = await service.ttl(key);

			expect(mockRedisInstance.ttl).toHaveBeenCalledWith(key);
			expect(result).toBe(ttlValue);
		});

		it("should return -1 if key has no TTL", async () => {
			const key = "test-key";
			mockRedisInstance.ttl.mockResolvedValueOnce(-1);

			const result = await service.ttl(key);

			expect(result).toBe(-1);
		});

		it("should return -2 if key does not exist", async () => {
			const key = "non-existent-key";
			mockRedisInstance.ttl.mockResolvedValueOnce(-2);

			const result = await service.ttl(key);

			expect(result).toBe(-2);
		});

		it("should throw RedisClientError if Redis throws", async () => {
			const key = "test-key";
			const error = new Error("Redis error");
			mockRedisInstance.ttl.mockRejectedValueOnce(error);

			await expect(service.ttl(key)).rejects.toThrow(RedisClientError);

			// Повторный вызов с новым mock
			mockRedisInstance.ttl.mockRejectedValueOnce(error);
			await expect(service.ttl(key)).rejects.toThrow(`Ошибка получения TTL ключа ${key}`);
		});

		it("should throw RedisClientError if client is not initialized", async () => {
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;

			await expect(service.ttl("key")).rejects.toThrow(RedisClientError);

			// Сбрасываем instance перед вторым вызовом
			(RedisClientService as unknown as { instance: Redis | null }).instance = null;
			await expect(service.ttl("key")).rejects.toThrow("Redis клиент не инициализирован");
		});
	});

	describe("makeUserKey", () => {
		it("should format user key correctly", () => {
			const userId = "user123";
			const key = "sessions";

			const result = service.makeUserKey(userId, key);

			expect(result).toBe("user:user123:sessions");
		});

		it("should handle empty userId", () => {
			const userId = "";
			const key = "sessions";

			const result = service.makeUserKey(userId, key);

			expect(result).toBe("user::sessions");
		});

		it("should handle empty key", () => {
			const userId = "user123";
			const key = "";

			const result = service.makeUserKey(userId, key);

			expect(result).toBe("user:user123:");
		});
	});

	describe("isConnected", () => {
		it("should return true if Redis is connected", async () => {
			await service.onModuleInit();
			mockRedisInstance.status = "ready";

			const result = service.isConnected();

			expect(result).toBe(true);
		});

		it("should return false if Redis is not connected", async () => {
			await service.onModuleInit();
			mockRedisInstance.status = "disconnected" as never;

			const result = service.isConnected();

			expect(result).toBe(false);
		});

		it("should return false if Redis is not initialized", () => {
			const result = service.isConnected();

			expect(result).toBe(false);
		});
	});

	describe("disconnect", () => {
		it("should disconnect and clear instance", async () => {
			await service.onModuleInit();

			await service.disconnect();

			expect(mockRedisInstance.quit).toHaveBeenCalled();
			expect((RedisClientService as unknown as { instance: Redis | null }).instance).toBeNull();
		});

		it("should not throw if already disconnected", async () => {
			await expect(service.disconnect()).resolves.not.toThrow();
		});
	});

	describe("Redis event handlers", () => {
		it("should handle connect event", async () => {
			let connectHandler: () => void = () => {};
			mockRedisInstance.on.mockImplementation(
				(event: string | symbol, handler: (...args: unknown[]) => void) => {
					if (event === "connect") {
						connectHandler = handler;
					}
					return mockRedisInstance;
				}
			);

			await service.onModuleInit();

			// Вызываем handler для покрытия
			expect(() => connectHandler()).not.toThrow();
		});

		it("should handle error event", async () => {
			let errorHandler: (error: Error) => void = () => {};
			mockRedisInstance.on.mockImplementation(
				(event: string | symbol, handler: (...args: unknown[]) => void) => {
					if (event === "error") {
						errorHandler = handler as (error: Error) => void;
					}
					return mockRedisInstance;
				}
			);

			await service.onModuleInit();

			// Вызываем handler для покрытия
			const testError = new Error("Test error");
			expect(() => errorHandler(testError)).not.toThrow();
		});

		it("should handle error event without stack", async () => {
			let errorHandler: (error: Error) => void = () => {};
			mockRedisInstance.on.mockImplementation(
				(event: string | symbol, handler: (...args: unknown[]) => void) => {
					if (event === "error") {
						errorHandler = handler as (error: Error) => void;
					}
					return mockRedisInstance;
				}
			);

			await service.onModuleInit();

			// Вызываем handler для покрытия случая без stack
			const testError = new Error("Test error");
			delete testError.stack;
			expect(() => errorHandler(testError)).not.toThrow();
		});

		it("should handle close event", async () => {
			let closeHandler: () => void = () => {};
			mockRedisInstance.on.mockImplementation(
				(event: string | symbol, handler: (...args: unknown[]) => void) => {
					if (event === "close") {
						closeHandler = handler;
					}
					return mockRedisInstance;
				}
			);

			await service.onModuleInit();

			// Вызываем handler для покрытия
			expect(() => closeHandler()).not.toThrow();
		});
	});

	describe("error handling for non-Error objects", () => {
		it("should handle non-Error object in get", async () => {
			await service.onModuleInit();
			mockRedisInstance.get.mockRejectedValueOnce("string error");

			await expect(service.get("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle non-Error object in set", async () => {
			await service.onModuleInit();
			mockRedisInstance.set.mockRejectedValueOnce("string error");

			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should handle non-Error object in del", async () => {
			await service.onModuleInit();
			mockRedisInstance.del.mockRejectedValueOnce("string error");

			await expect(service.del("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle non-Error object in ttl", async () => {
			await service.onModuleInit();
			mockRedisInstance.ttl.mockRejectedValueOnce("string error");

			await expect(service.ttl("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle non-Error object in onModuleInit", async () => {
			mockRedisInstance.connect.mockRejectedValueOnce("string error");

			await expect(service.onModuleInit()).rejects.toThrow(RedisClientError);
		});
	});

	describe("error handling for Error objects without stack", () => {
		it("should handle Error without stack in get", async () => {
			await service.onModuleInit();
			const errorWithoutStack = new Error("Error without stack");
			delete errorWithoutStack.stack;
			mockRedisInstance.get.mockRejectedValueOnce(errorWithoutStack);

			await expect(service.get("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle Error without stack in set", async () => {
			await service.onModuleInit();
			const errorWithoutStack = new Error("Error without stack");
			delete errorWithoutStack.stack;
			mockRedisInstance.set.mockRejectedValueOnce(errorWithoutStack);

			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should handle Error without stack in del", async () => {
			await service.onModuleInit();
			const errorWithoutStack = new Error("Error without stack");
			delete errorWithoutStack.stack;
			mockRedisInstance.del.mockRejectedValueOnce(errorWithoutStack);

			await expect(service.del("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle Error without stack in ttl", async () => {
			await service.onModuleInit();
			const errorWithoutStack = new Error("Error without stack");
			delete errorWithoutStack.stack;
			mockRedisInstance.ttl.mockRejectedValueOnce(errorWithoutStack);

			await expect(service.ttl("key")).rejects.toThrow(RedisClientError);
		});

		it("should handle Error without stack in onModuleInit", async () => {
			const errorWithoutStack = new Error("Error without stack");
			delete errorWithoutStack.stack;
			mockRedisInstance.connect.mockRejectedValueOnce(errorWithoutStack);

			await expect(service.onModuleInit()).rejects.toThrow(RedisClientError);
		});
	});

	describe("Hash methods", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		describe("hset", () => {
			it("should set field in hash", async () => {
				mockRedisInstance.hset.mockResolvedValueOnce(1);
				const result = await service.hset("hash:key", "field", "value");
				expect(mockRedisInstance.hset).toHaveBeenCalledWith("hash:key", "field", "value");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hset.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hset("hash:key", "field", "value")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hset.mockRejectedValueOnce(redisError);
				await expect(service.hset("hash:key", "field", "value")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hset("hash:key", "field", "value")).rejects.toThrow(RedisClientError);
			});
		});

		describe("hget", () => {
			it("should get field from hash", async () => {
				mockRedisInstance.hget.mockResolvedValueOnce("value");
				const result = await service.hget("hash:key", "field");
				expect(mockRedisInstance.hget).toHaveBeenCalledWith("hash:key", "field");
				expect(result).toBe("value");
			});

			it("should return null if field does not exist", async () => {
				mockRedisInstance.hget.mockResolvedValueOnce(null);
				const result = await service.hget("hash:key", "field");
				expect(result).toBeNull();
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hget.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hget("hash:key", "field")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hget.mockRejectedValueOnce(redisError);
				await expect(service.hget("hash:key", "field")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hget("hash:key", "field")).rejects.toThrow(RedisClientError);
			});
		});

		describe("hgetall", () => {
			it("should get all fields from hash", async () => {
				const hash = { field1: "value1", field2: "value2" };
				mockRedisInstance.hgetall.mockResolvedValueOnce(hash);
				const result = await service.hgetall("hash:key");
				expect(mockRedisInstance.hgetall).toHaveBeenCalledWith("hash:key");
				expect(result).toEqual(hash);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hgetall.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hgetall("hash:key")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hgetall.mockRejectedValueOnce(redisError);
				await expect(service.hgetall("hash:key")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hgetall("hash:key")).rejects.toThrow(RedisClientError);
			});
		});

		describe("hdel", () => {
			it("should delete field from hash", async () => {
				mockRedisInstance.hdel.mockResolvedValueOnce(1);
				const result = await service.hdel("hash:key", "field");
				expect(mockRedisInstance.hdel).toHaveBeenCalledWith("hash:key", "field");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hdel.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hdel("hash:key", "field")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hdel.mockRejectedValueOnce(redisError);
				await expect(service.hdel("hash:key", "field")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hdel("hash:key", "field")).rejects.toThrow(RedisClientError);
			});
		});

		describe("hexists", () => {
			it("should check if field exists in hash", async () => {
				mockRedisInstance.hexists.mockResolvedValueOnce(1);
				const result = await service.hexists("hash:key", "field");
				expect(mockRedisInstance.hexists).toHaveBeenCalledWith("hash:key", "field");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hexists.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hexists("hash:key", "field")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hexists.mockRejectedValueOnce(redisError);
				await expect(service.hexists("hash:key", "field")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hexists("hash:key", "field")).rejects.toThrow(RedisClientError);
			});
		});

		describe("hscan", () => {
			it("should scan hash with pattern", async () => {
				mockRedisInstance.hscan.mockResolvedValueOnce(["0", ["field1", "value1"]]);
				const result = await service.hscan("hash:key", 0, "field*", 10);
				expect(mockRedisInstance.hscan).toHaveBeenCalledWith(
					"hash:key",
					0,
					"MATCH",
					"field*",
					"COUNT",
					10
				);
				expect(result).toEqual(["0", ["field1", "value1"]]);
			});

			it("should scan hash without pattern and count", async () => {
				mockRedisInstance.hscan.mockResolvedValueOnce(["0", ["field1", "value1"]]);
				const result = await service.hscan("hash:key", 0);
				expect(mockRedisInstance.hscan).toHaveBeenCalledWith("hash:key", 0);
				expect(result).toEqual(["0", ["field1", "value1"]]);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.hscan.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.hscan("hash:key", 0)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.hscan.mockRejectedValueOnce(redisError);
				await expect(service.hscan("hash:key", 0)).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.hscan("hash:key", 0)).rejects.toThrow(RedisClientError);
			});
		});
	});

	describe("Sorted Set methods", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		describe("zadd", () => {
			it("should add member to sorted set", async () => {
				(
					mockRedisInstance.zadd as unknown as jest.MockedFunction<
						(...args: unknown[]) => Promise<number>
					>
				).mockResolvedValueOnce(1);
				const result = await service.zadd("zset:key", 100, "member");
				expect(mockRedisInstance.zadd).toHaveBeenCalledWith("zset:key", 100, "member");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.zadd.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.zadd("zset:key", 100, "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.zadd.mockRejectedValueOnce(redisError);
				await expect(service.zadd("zset:key", 100, "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.zadd("zset:key", 100, "member")).rejects.toThrow(RedisClientError);
			});
		});

		describe("zrange", () => {
			it("should get range from sorted set", async () => {
				mockRedisInstance.zrange.mockResolvedValueOnce(["member1", "member2"]);
				const result = await service.zrange("zset:key", 0, -1);
				expect(mockRedisInstance.zrange).toHaveBeenCalledWith("zset:key", 0, -1);
				expect(result).toEqual(["member1", "member2"]);
			});

			it("should get range with scores", async () => {
				mockRedisInstance.zrange.mockResolvedValueOnce(["member1", "100", "member2", "200"]);
				const result = await service.zrange("zset:key", 0, -1, true);
				expect(mockRedisInstance.zrange).toHaveBeenCalledWith("zset:key", 0, -1, "WITHSCORES");
				expect(result).toEqual(["member1", "100", "member2", "200"]);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.zrange.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.zrange("zset:key", 0, -1)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.zrange.mockRejectedValueOnce(redisError);
				await expect(service.zrange("zset:key", 0, -1)).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.zrange("zset:key", 0, -1)).rejects.toThrow(RedisClientError);
			});
		});

		describe("zrem", () => {
			it("should remove member from sorted set", async () => {
				mockRedisInstance.zrem.mockResolvedValueOnce(1);
				const result = await service.zrem("zset:key", "member");
				expect(mockRedisInstance.zrem).toHaveBeenCalledWith("zset:key", "member");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.zrem.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.zrem("zset:key", "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.zrem.mockRejectedValueOnce(redisError);
				await expect(service.zrem("zset:key", "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.zrem("zset:key", "member")).rejects.toThrow(RedisClientError);
			});
		});

		describe("zremrangebyscore", () => {
			it("should remove members by score range", async () => {
				mockRedisInstance.zremrangebyscore.mockResolvedValueOnce(2);
				const result = await service.zremrangebyscore("zset:key", 100, 200);
				expect(mockRedisInstance.zremrangebyscore).toHaveBeenCalledWith("zset:key", 100, 200);
				expect(result).toBe(2);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.zremrangebyscore.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.zremrangebyscore("zset:key", 100, 200)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.zremrangebyscore.mockRejectedValueOnce(redisError);
				await expect(service.zremrangebyscore("zset:key", 100, 200)).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.zremrangebyscore("zset:key", 100, 200)).rejects.toThrow(RedisClientError);
			});
		});

		describe("zscore", () => {
			it("should get score of member", async () => {
				mockRedisInstance.zscore.mockResolvedValueOnce("100");
				const result = await service.zscore("zset:key", "member");
				expect(mockRedisInstance.zscore).toHaveBeenCalledWith("zset:key", "member");
				expect(result).toBe("100");
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.zscore.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.zscore("zset:key", "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.zscore.mockRejectedValueOnce(redisError);
				await expect(service.zscore("zset:key", "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.zscore("zset:key", "member")).rejects.toThrow(RedisClientError);
			});
		});
	});

	describe("Set methods", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		describe("sadd", () => {
			it("should add member to set", async () => {
				mockRedisInstance.sadd.mockResolvedValueOnce(1);
				const result = await service.sadd("set:key", "member");
				expect(mockRedisInstance.sadd).toHaveBeenCalledWith("set:key", "member");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.sadd.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.sadd("set:key", "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.sadd.mockRejectedValueOnce(redisError);
				await expect(service.sadd("set:key", "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.sadd("set:key", "member")).rejects.toThrow(RedisClientError);
			});
		});

		describe("smembers", () => {
			it("should get all members from set", async () => {
				mockRedisInstance.smembers.mockResolvedValueOnce(["member1", "member2"]);
				const result = await service.smembers("set:key");
				expect(mockRedisInstance.smembers).toHaveBeenCalledWith("set:key");
				expect(result).toEqual(["member1", "member2"]);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.smembers.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.smembers("set:key")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.smembers.mockRejectedValueOnce(redisError);
				await expect(service.smembers("set:key")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.smembers("set:key")).rejects.toThrow(RedisClientError);
			});
		});

		describe("srem", () => {
			it("should remove member from set", async () => {
				mockRedisInstance.srem.mockResolvedValueOnce(1);
				const result = await service.srem("set:key", "member");
				expect(mockRedisInstance.srem).toHaveBeenCalledWith("set:key", "member");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.srem.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.srem("set:key", "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.srem.mockRejectedValueOnce(redisError);
				await expect(service.srem("set:key", "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.srem("set:key", "member")).rejects.toThrow(RedisClientError);
			});
		});

		describe("sismember", () => {
			it("should check if member exists in set", async () => {
				mockRedisInstance.sismember.mockResolvedValueOnce(1);
				const result = await service.sismember("set:key", "member");
				expect(mockRedisInstance.sismember).toHaveBeenCalledWith("set:key", "member");
				expect(result).toBe(1);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.sismember.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.sismember("set:key", "member")).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.sismember.mockRejectedValueOnce(redisError);
				await expect(service.sismember("set:key", "member")).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.sismember("set:key", "member")).rejects.toThrow(RedisClientError);
			});
		});
	});

	describe("Streams methods", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		describe("xadd", () => {
			it("should add entry to stream", async () => {
				mockRedisInstance.xadd.mockResolvedValueOnce("1234567890-0");
				const result = await service.xadd("stream:key", "*", { field1: "value1", field2: "value2" });
				expect(mockRedisInstance.xadd).toHaveBeenCalledWith(
					"stream:key",
					"*",
					"field1",
					"value1",
					"field2",
					"value2"
				);
				expect(result).toBe("1234567890-0");
			});

			it("should throw error if xadd returns null", async () => {
				mockRedisInstance.xadd.mockResolvedValueOnce(null);
				await expect(service.xadd("stream:key", "*", { field1: "value1" })).rejects.toThrow(
					RedisClientError
				);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.xadd.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.xadd("stream:key", "*", { field1: "value1" })).rejects.toThrow(
					RedisClientError
				);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.xadd.mockRejectedValueOnce(redisError);
				await expect(service.xadd("stream:key", "*", { field1: "value1" })).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.xadd("stream:key", "*", { field1: "value1" })).rejects.toThrow(
					RedisClientError
				);
			});
		});

		describe("xread", () => {
			it("should read entries from stream", async () => {
				const mockResult: Array<[string, Array<[string, string[]]>]> = [
					["stream:key", [["1234567890-0", ["field1", "value1", "field2", "value2"]]]],
				];
				mockRedisInstance.xread.mockResolvedValueOnce(mockResult);
				const result = await service.xread([{ key: "stream:key", id: "0" }], 10);
				expect(result).toEqual([
					{
						key: "stream:key",
						messages: [{ id: "1234567890-0", fields: { field1: "value1", field2: "value2" } }],
					},
				]);
			});

			it("should return null if no entries", async () => {
				mockRedisInstance.xread.mockResolvedValueOnce(null);
				const result = await service.xread([{ key: "stream:key", id: "0" }]);
				expect(result).toBeNull();
			});

			it("should read entries without count", async () => {
				const mockResult: Array<[string, Array<[string, string[]]>]> = [
					["stream:key", [["1234567890-0", ["field1", "value1"]]]],
				];
				mockRedisInstance.xread.mockResolvedValueOnce(mockResult);
				const result = await service.xread([{ key: "stream:key", id: "0" }]);
				expect(result).toEqual([
					{
						key: "stream:key",
						messages: [{ id: "1234567890-0", fields: { field1: "value1" } }],
					},
				]);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.xread.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.xread([{ key: "stream:key", id: "0" }])).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.xread.mockRejectedValueOnce(redisError);
				await expect(service.xread([{ key: "stream:key", id: "0" }])).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.xread([{ key: "stream:key", id: "0" }])).rejects.toThrow(RedisClientError);
			});
		});

		describe("xtrim", () => {
			it("should trim stream to maxlen", async () => {
				mockRedisInstance.xtrim.mockResolvedValueOnce(5);
				const result = await service.xtrim("stream:key", 100);
				expect(mockRedisInstance.xtrim).toHaveBeenCalledWith("stream:key", "MAXLEN", "~", 100);
				expect(result).toBe(5);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.xtrim.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.xtrim("stream:key", 100)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.xtrim.mockRejectedValueOnce(redisError);
				await expect(service.xtrim("stream:key", 100)).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.xtrim("stream:key", 100)).rejects.toThrow(RedisClientError);
			});
		});
	});

	describe("Cleanup methods", () => {
		beforeEach(async () => {
			await service.onModuleInit();
		});

		describe("scan", () => {
			it("should scan keys with pattern", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
				const result = await service.scan(0, "key*", 10);
				expect(mockRedisInstance.scan).toHaveBeenCalledWith(0, "MATCH", "key*", "COUNT", 10);
				expect(result).toEqual(["0", ["key1", "key2"]]);
			});

			it("should scan keys without pattern and count", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
				const result = await service.scan(0);
				expect(mockRedisInstance.scan).toHaveBeenCalledWith(0);
				expect(result).toEqual(["0", ["key1", "key2"]]);
			});

			it("should scan keys with pattern but without count", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
				const result = await service.scan(0, "key*");
				expect(mockRedisInstance.scan).toHaveBeenCalledWith(0, "MATCH", "key*");
				expect(result).toEqual(["0", ["key1", "key2"]]);
			});

			it("should scan keys with count but without pattern", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
				const result = await service.scan(0, undefined, 10);
				expect(mockRedisInstance.scan).toHaveBeenCalledWith(0, "COUNT", 10);
				expect(result).toEqual(["0", ["key1", "key2"]]);
			});

			it("should throw RedisClientError on error", async () => {
				mockRedisInstance.scan.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.scan(0)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.scan.mockRejectedValueOnce(redisError);
				await expect(service.scan(0)).rejects.toThrow(redisError);
			});

			it("should throw RedisClientError if client is not initialized", async () => {
				(RedisClientService as unknown as { instance: Redis | null }).instance = null;
				await expect(service.scan(0)).rejects.toThrow(RedisClientError);
			});
		});

		describe("cleanupOldKeys", () => {
			it("should cleanup old keys", async () => {
				mockRedisInstance.scan
					.mockResolvedValueOnce(["0", ["key1", "key2"]])
					.mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(86400).mockResolvedValueOnce(-1);
				mockRedisInstance.object.mockResolvedValueOnce(86401);
				mockRedisInstance.del.mockResolvedValueOnce(1);

				const result = await service.cleanupOldKeys("key*", 86400);
				expect(result).toBe(1);
			});

			it("should not cleanup keys without TTL when idleTime is less than or equal to maxAgeSeconds", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]).mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(-1); // Ключ без TTL
				mockRedisInstance.object.mockResolvedValueOnce(3600); // idleTime меньше maxAgeSeconds

				const result = await service.cleanupOldKeys("key*", 86400);
				expect(result).toBe(0);
				expect(mockRedisInstance.del).not.toHaveBeenCalled();
			});

			it("should cleanup keys with TTL greater than maxAgeSeconds", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]).mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(100000); // TTL больше maxAgeSeconds
				mockRedisInstance.del.mockResolvedValueOnce(1);

				const result = await service.cleanupOldKeys("key*", 86400);
				expect(result).toBe(1);
				expect(mockRedisInstance.del).toHaveBeenCalledWith("key1");
			});

			it("should not cleanup keys with TTL less than or equal to maxAgeSeconds", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]).mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(3600); // TTL меньше maxAgeSeconds

				const result = await service.cleanupOldKeys("key*", 86400);
				expect(result).toBe(0);
				expect(mockRedisInstance.del).not.toHaveBeenCalled();
			});

			it("should not cleanup keys with TTL equal to maxAgeSeconds", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]).mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(86400); // TTL равен maxAgeSeconds

				const result = await service.cleanupOldKeys("key*", 86400);
				expect(result).toBe(0);
				expect(mockRedisInstance.del).not.toHaveBeenCalled();
			});

			it("should throw RedisClientError on error in scan", async () => {
				mockRedisInstance.scan.mockRejectedValueOnce(new Error("Redis error"));
				await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(RedisClientError);
			});

			it("should throw RedisClientError on error in ttl", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]);
				mockRedisInstance.scan.mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockRejectedValueOnce(new Error("TTL error"));
				await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(RedisClientError);
			});

			it("should throw RedisClientError on error in object", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]);
				mockRedisInstance.scan.mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(-1);
				mockRedisInstance.object.mockRejectedValueOnce(new Error("Object error"));
				await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(RedisClientError);
			});

			it("should throw RedisClientError on error in del", async () => {
				mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1"]]);
				mockRedisInstance.scan.mockResolvedValueOnce(["0", []]);
				mockRedisInstance.ttl.mockResolvedValueOnce(-1);
				mockRedisInstance.object.mockResolvedValueOnce(86401);
				mockRedisInstance.del.mockRejectedValueOnce(new Error("Del error"));
				await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(RedisClientError);
			});

			it("should rethrow RedisClientError if error is already RedisClientError", async () => {
				const redisError = new RedisClientError("Test error", new Error("Original"), mockLogger);
				mockRedisInstance.scan.mockRejectedValueOnce(redisError);
				await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(redisError);
			});
		});
	});
});
