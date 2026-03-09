import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { TestingModule } from "@nestjs/testing";
import type { RedisClientModuleOptions } from "src/types/module-options.interface";

jest.mock("ioredis");
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

describe("RedisConnectionService", () => {
	let service: RedisConnectionService;
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
		RedisConnectionService.resetInstance();

		mockRedisInstance = {
			connect: jest.fn().mockResolvedValue(undefined),
			quit: jest.fn().mockResolvedValue("OK"),
			on: jest.fn().mockReturnThis(),
			status: "ready",
		} as unknown as jest.Mocked<Redis>;

		(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedisInstance);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{ provide: REDIS_CLIENT_OPTIONS, useValue: mockOptions },
				{ provide: LoggerService, useValue: mockLogger },
				RedisConnectionService,
			],
		}).compile();

		service = module.get<RedisConnectionService>(RedisConnectionService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("onModuleInit", () => {
		it("should initialize Redis client", async () => {
			await service.onModuleInit();

			expect(Redis).toHaveBeenCalledWith({
				host: mockOptions.host,
				port: mockOptions.port,
				password: mockOptions.password,
				db: mockOptions.db ?? 0,
				lazyConnect: true,
				...mockOptions.options,
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
		});

		it("should use default db when not provided", async () => {
			RedisConnectionService.resetInstance();
			const opts = { host: "localhost", port: 6379 };

			const mod = await Test.createTestingModule({
				providers: [
					{ provide: REDIS_CLIENT_OPTIONS, useValue: opts },
					{ provide: LoggerService, useValue: mockLogger },
					RedisConnectionService,
				],
			}).compile();

			const conn = mod.get<RedisConnectionService>(RedisConnectionService);
			await conn.onModuleInit();

			expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ db: 0 }));
		});

		it("should merge additional options", async () => {
			RedisConnectionService.resetInstance();
			const opts: RedisClientModuleOptions = {
				host: "localhost",
				port: 6379,
				options: { connectTimeout: 5000 },
			};

			const mod = await Test.createTestingModule({
				providers: [
					{ provide: REDIS_CLIENT_OPTIONS, useValue: opts },
					{ provide: LoggerService, useValue: mockLogger },
					RedisConnectionService,
				],
			}).compile();

			const conn = mod.get<RedisConnectionService>(RedisConnectionService);
			await conn.onModuleInit();

			expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ connectTimeout: 5000 }));
		});

		it("should work when options.options is undefined", async () => {
			RedisConnectionService.resetInstance();
			const opts: RedisClientModuleOptions = {
				host: "localhost",
				port: 6379,
			};

			const mod = await Test.createTestingModule({
				providers: [
					{ provide: REDIS_CLIENT_OPTIONS, useValue: opts },
					{ provide: LoggerService, useValue: mockLogger },
					RedisConnectionService,
				],
			}).compile();

			const conn = mod.get<RedisConnectionService>(RedisConnectionService);
			await conn.onModuleInit();

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					host: "localhost",
					port: 6379,
					lazyConnect: true,
				})
			);
		});
	});

	describe("onModuleDestroy", () => {
		it("should disconnect on destroy", async () => {
			await service.onModuleInit();
			await service.onModuleDestroy();

			expect(mockRedisInstance.quit).toHaveBeenCalled();
		});
	});

	describe("getClient", () => {
		it("should throw when client not initialized", () => {
			expect(() => service.getClient()).toThrow(RedisClientError);
			expect(() => service.getClient()).toThrow("Redis клиент не инициализирован");
		});

		it("should return client when initialized", async () => {
			await service.onModuleInit();
			const client = service.getClient();
			expect(client).toBe(mockRedisInstance);
		});
	});

	describe("isConnected", () => {
		it("should return false when not initialized", () => {
			expect(service.isConnected()).toBe(false);
		});

		it("should return true when ready", async () => {
			await service.onModuleInit();
			mockRedisInstance.status = "ready";
			expect(service.isConnected()).toBe(true);
		});

		it("should return false when not ready", async () => {
			await service.onModuleInit();
			(mockRedisInstance as unknown as { status: string }).status = "disconnected";
			expect(service.isConnected()).toBe(false);
		});
	});

	describe("disconnect", () => {
		it("should quit and clear instance", async () => {
			await service.onModuleInit();
			await service.disconnect();

			expect(mockRedisInstance.quit).toHaveBeenCalled();
			expect(RedisConnectionService.getInstance()).toBeNull();
		});

		it("should not throw when already disconnected", async () => {
			await expect(service.disconnect()).resolves.not.toThrow();
		});
	});

	describe("getInstance", () => {
		it("should return null when not initialized", () => {
			expect(RedisConnectionService.getInstance()).toBeNull();
		});

		it("should return instance when initialized", async () => {
			await service.onModuleInit();
			expect(RedisConnectionService.getInstance()).toBe(mockRedisInstance);
		});
	});

	describe("Event handlers", () => {
		it("should handle connect event", async () => {
			let handler: () => void = () => {};
			mockRedisInstance.on.mockImplementation((e: string | symbol, h: () => void) => {
				if (e === "connect") handler = h;
				return mockRedisInstance;
			});
			await service.onModuleInit();
			expect(() => handler()).not.toThrow();
		});

		it("should handle error event with stack", async () => {
			let handler: (err: Error) => void = () => {};
			mockRedisInstance.on.mockImplementation((e: string | symbol, h: (err: Error) => void) => {
				if (e === "error") handler = h;
				return mockRedisInstance;
			});
			await service.onModuleInit();
			expect(() => handler(new Error("test"))).not.toThrow();
		});

		it("should handle error event without stack", async () => {
			let handler: (err: Error) => void = () => {};
			mockRedisInstance.on.mockImplementation((e: string | symbol, h: (err: Error) => void) => {
				if (e === "error") handler = h;
				return mockRedisInstance;
			});
			await service.onModuleInit();
			const err = new Error("test");
			delete (err as { stack?: string }).stack;
			expect(() => handler(err)).not.toThrow();
		});

		it("should handle close event", async () => {
			let handler: () => void = () => {};
			mockRedisInstance.on.mockImplementation((e: string | symbol, h: () => void) => {
				if (e === "close") handler = h;
				return mockRedisInstance;
			});
			await service.onModuleInit();
			expect(() => handler()).not.toThrow();
		});
	});
});
