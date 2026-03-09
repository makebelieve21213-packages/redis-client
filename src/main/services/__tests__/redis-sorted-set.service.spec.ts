import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisSortedSetService from "src/main/services/redis-sorted-set.service";
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

describe("RedisSortedSetService", () => {
	let service: RedisSortedSetService;
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
			zadd: jest.fn(),
			zrange: jest.fn(),
			zrem: jest.fn(),
			zremrangebyscore: jest.fn(),
			zscore: jest.fn(),
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
				RedisSortedSetService,
			],
		}).compile();

		connectionService = module.get<RedisConnectionService>(RedisConnectionService);
		service = module.get<RedisSortedSetService>(RedisSortedSetService);

		await connectionService.onModuleInit();
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("zadd", () => {
		it("should add member with score", async () => {
			(mockRedis.zadd as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.zadd("zset:key", 100, "member");
			expect(mockRedis.zadd).toHaveBeenCalledWith("zset:key", 100, "member");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.zadd as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.zadd("zset:key", 100, "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("zrange", () => {
		it("should get range without scores", async () => {
			(mockRedis.zrange as jest.Mock).mockResolvedValueOnce(["m1", "m2"]);
			const result = await service.zrange("zset:key", 0, -1);
			expect(mockRedis.zrange).toHaveBeenCalledWith("zset:key", 0, -1);
			expect(result).toEqual(["m1", "m2"]);
		});

		it("should get range with scores", async () => {
			(mockRedis.zrange as jest.Mock).mockResolvedValueOnce(["m1", "100", "m2", "200"]);
			const result = await service.zrange("zset:key", 0, -1, true);
			expect(mockRedis.zrange).toHaveBeenCalledWith("zset:key", 0, -1, "WITHSCORES");
			expect(result).toEqual(["m1", "100", "m2", "200"]);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.zrange as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.zrange("zset:key", 0, -1)).rejects.toThrow(RedisClientError);
		});
	});

	describe("zrem", () => {
		it("should remove member", async () => {
			(mockRedis.zrem as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.zrem("zset:key", "member");
			expect(mockRedis.zrem).toHaveBeenCalledWith("zset:key", "member");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.zrem as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.zrem("zset:key", "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("zremrangebyscore", () => {
		it("should remove by score range with numbers", async () => {
			(mockRedis.zremrangebyscore as jest.Mock).mockResolvedValueOnce(2);
			const result = await service.zremrangebyscore("zset:key", 100, 200);
			expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith("zset:key", 100, 200);
			expect(result).toBe(2);
		});

		it("should remove by score range with strings", async () => {
			(mockRedis.zremrangebyscore as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.zremrangebyscore("zset:key", "-inf", "+inf");
			expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith("zset:key", "-inf", "+inf");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.zremrangebyscore as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.zremrangebyscore("zset:key", 100, 200)).rejects.toThrow(RedisClientError);
		});
	});

	describe("zscore", () => {
		it("should get score", async () => {
			(mockRedis.zscore as jest.Mock).mockResolvedValueOnce("100");
			const result = await service.zscore("zset:key", "member");
			expect(mockRedis.zscore).toHaveBeenCalledWith("zset:key", "member");
			expect(result).toBe("100");
		});

		it("should return null when member missing", async () => {
			(mockRedis.zscore as jest.Mock).mockResolvedValueOnce(null);
			expect(await service.zscore("zset:key", "member")).toBeNull();
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.zscore as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.zscore("zset:key", "member")).rejects.toThrow(RedisClientError);
		});
	});

	describe("client not initialized", () => {
		it("should throw for zadd", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.zadd("k", 1, "m")).rejects.toThrow(RedisClientError);
		});

		it("should throw for zrange", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.zrange("k", 0, -1)).rejects.toThrow(RedisClientError);
		});

		it("should throw for zrem", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.zrem("k", "m")).rejects.toThrow(RedisClientError);
		});

		it("should throw for zremrangebyscore", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.zremrangebyscore("k", 0, 1)).rejects.toThrow(RedisClientError);
		});

		it("should throw for zscore", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.zscore("k", "m")).rejects.toThrow(RedisClientError);
		});
	});
});
