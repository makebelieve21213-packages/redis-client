import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisSetService from "src/main/services/redis-set.service";
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

describe("RedisSetService", () => {
	let service: RedisSetService;
	let connectionService: RedisConnectionService;
	let mockRedis: jest.Mocked<Redis>;

	beforeEach(async () => {
		const mockLogger = new LoggerService({} as { serviceName: string });
		RedisConnectionService.resetInstance();

		mockRedis = {
			connect: jest.fn().mockResolvedValue(undefined),
			quit: jest.fn().mockResolvedValue("OK"),
			on: jest.fn().mockReturnThis(),
			status: "ready",
			sadd: jest.fn(),
			smembers: jest.fn(),
			srem: jest.fn(),
			sismember: jest.fn(),
		} as unknown as jest.Mocked<Redis>;

		(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: REDIS_CLIENT_OPTIONS,
					useValue: { host: "localhost", port: 6379 } as RedisClientModuleOptions,
				},
				{ provide: LoggerService, useValue: mockLogger },
				RedisConnectionService,
				RedisSetService,
			],
		}).compile();

		connectionService = module.get<RedisConnectionService>(RedisConnectionService);
		service = module.get<RedisSetService>(RedisSetService);

		await connectionService.onModuleInit();
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("sadd", () => {
		it("should add member", async () => {
			(mockRedis.sadd as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.sadd("set:key", "member");
			expect(mockRedis.sadd).toHaveBeenCalledWith("set:key", "member");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.sadd as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.sadd("set:key", "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("smembers", () => {
		it("should return all members", async () => {
			(mockRedis.smembers as jest.Mock).mockResolvedValueOnce(["m1", "m2"]);
			const result = await service.smembers("set:key");
			expect(mockRedis.smembers).toHaveBeenCalledWith("set:key");
			expect(result).toEqual(["m1", "m2"]);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.smembers as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.smembers("set:key")).rejects.toThrow(RedisClientError);
		});
	});

	describe("srem", () => {
		it("should remove member", async () => {
			(mockRedis.srem as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.srem("set:key", "member");
			expect(mockRedis.srem).toHaveBeenCalledWith("set:key", "member");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.srem as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.srem("set:key", "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("sismember", () => {
		it("should return 1 when member exists", async () => {
			(mockRedis.sismember as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.sismember("set:key", "member");
			expect(mockRedis.sismember).toHaveBeenCalledWith("set:key", "member");
			expect(result).toBe(1);
		});

		it("should return 0 when member does not exist", async () => {
			(mockRedis.sismember as jest.Mock).mockResolvedValueOnce(0);
			const result = await service.sismember("set:key", "member");
			expect(result).toBe(0);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.sismember as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.sismember("set:key", "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("client not initialized", () => {
		it("should throw for sadd", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.sadd("k", "m")).rejects.toThrow(RedisClientError);
		});

		it("should throw for smembers", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.smembers("k")).rejects.toThrow(RedisClientError);
		});

		it("should throw for srem", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.srem("k", "m")).rejects.toThrow(RedisClientError);
		});

		it("should throw for sismember", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.sismember("k", "m")).rejects.toThrow(RedisClientError);
		});
	});
});
