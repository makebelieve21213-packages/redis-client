import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisKeyService from "src/main/services/redis-key.service";
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

describe("RedisKeyService", () => {
	let service: RedisKeyService;
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
			get: jest.fn(),
			set: jest.fn(),
			setex: jest.fn(),
			del: jest.fn(),
			ttl: jest.fn(),
			scan: jest.fn(),
			object: jest.fn(),
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
				RedisKeyService,
			],
		}).compile();

		connectionService = module.get<RedisConnectionService>(RedisConnectionService);
		service = module.get<RedisKeyService>(RedisKeyService);

		await connectionService.onModuleInit();
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("get", () => {
		it("should get value", async () => {
			(mockRedis.get as jest.Mock).mockResolvedValueOnce("val");
			expect(await service.get("key")).toBe("val");
			expect(mockRedis.get).toHaveBeenCalledWith("key");
		});

		it("should return null when key missing", async () => {
			(mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
			expect(await service.get("key")).toBeNull();
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.get as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.get("key")).rejects.toThrow(RedisClientError);
		});
	});

	describe("set", () => {
		it("should set without TTL", async () => {
			(mockRedis.set as jest.Mock).mockResolvedValueOnce("OK");
			await service.set("key", "value");
			expect(mockRedis.set).toHaveBeenCalledWith("key", "value");
			expect(mockRedis.setex).not.toHaveBeenCalled();
		});

		it("should set with TTL", async () => {
			(mockRedis.setex as jest.Mock).mockResolvedValueOnce("OK");
			await service.set("key", "value", 60);
			expect(mockRedis.setex).toHaveBeenCalledWith("key", 60, "value");
		});

		it("should use set for TTL 0", async () => {
			(mockRedis.set as jest.Mock).mockResolvedValueOnce("OK");
			await service.set("key", "value", 0);
			expect(mockRedis.set).toHaveBeenCalledWith("key", "value");
		});

		it("should throw when not connected", async () => {
			(mockRedis as unknown as { status: string }).status = "connecting";
			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should throw on Redis error", async () => {
			(mockRedis.set as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should handle non-Error in set catch", async () => {
			(mockRedis.set as jest.Mock).mockRejectedValueOnce("string error");
			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should handle Error without stack in set catch", async () => {
			const err = new Error("no stack");
			delete (err as { stack?: string }).stack;
			(mockRedis.set as jest.Mock).mockRejectedValueOnce(err);
			await expect(service.set("key", "value")).rejects.toThrow(RedisClientError);
		});

		it("should include client.status null in error when disconnected", async () => {
			(mockRedis as unknown as { status: string | null }).status = null;
			await expect(service.set("key", "value")).rejects.toThrow(/Статус: null/);
		});
	});

	describe("del", () => {
		it("should delete key", async () => {
			(mockRedis.del as jest.Mock).mockResolvedValueOnce(1);
			expect(await service.del("key")).toBe(1);
			expect(mockRedis.del).toHaveBeenCalledWith("key");
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.del as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.del("key")).rejects.toThrow(RedisClientError);
		});
	});

	describe("ttl", () => {
		it("should return TTL", async () => {
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(3600);
			expect(await service.ttl("key")).toBe(3600);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.ttl as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.ttl("key")).rejects.toThrow(RedisClientError);
		});
	});

	describe("makeUserKey", () => {
		it("should format user key", () => {
			expect(service.makeUserKey("user1", "sessions")).toBe("user:user1:sessions");
		});
	});

	describe("scan", () => {
		it("should scan with cursor only", async () => {
			(mockRedis.scan as jest.Mock).mockResolvedValueOnce(["0", ["k1"]]);
			const result = await service.scan(0);
			expect(mockRedis.scan).toHaveBeenCalledWith(0);
			expect(result).toEqual(["0", ["k1"]]);
		});

		it("should scan with pattern", async () => {
			(mockRedis.scan as jest.Mock).mockResolvedValueOnce(["0", ["k1"]]);
			const result = await service.scan(0, "k*");
			expect(mockRedis.scan).toHaveBeenCalledWith(0, "MATCH", "k*");
			expect(result).toEqual(["0", ["k1"]]);
		});

		it("should scan with count", async () => {
			(mockRedis.scan as jest.Mock).mockResolvedValueOnce(["0", ["k1"]]);
			const result = await service.scan(0, undefined, 50);
			expect(mockRedis.scan).toHaveBeenCalledWith(0, "COUNT", 50);
			expect(result).toEqual(["0", ["k1"]]);
		});

		it("should scan with count 0", async () => {
			(mockRedis.scan as jest.Mock).mockResolvedValueOnce(["0", []]);
			const result = await service.scan(0, undefined, 0);
			expect(mockRedis.scan).toHaveBeenCalledWith(0, "COUNT", 0);
			expect(result).toEqual(["0", []]);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.scan as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.scan(0)).rejects.toThrow(RedisClientError);
		});
	});

	describe("cleanupOldKeys", () => {
		it("should cleanup keys with TTL greater than maxAge", async () => {
			(mockRedis.scan as jest.Mock)
				.mockResolvedValueOnce(["0", ["key1"]])
				.mockResolvedValueOnce(["0", []]);
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(100000);
			(mockRedis.del as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.cleanupOldKeys("key*", 86400);
			expect(result).toBe(1);
		});

		it("should cleanup keys without TTL when idleTime > maxAge", async () => {
			(mockRedis.scan as jest.Mock)
				.mockResolvedValueOnce(["0", ["key1"]])
				.mockResolvedValueOnce(["0", []]);
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(-1);
			(mockRedis.object as jest.Mock).mockResolvedValueOnce(100000);
			(mockRedis.del as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.cleanupOldKeys("key*", 86400);
			expect(result).toBe(1);
		});

		it("should not cleanup when TTL <= maxAge", async () => {
			(mockRedis.scan as jest.Mock)
				.mockResolvedValueOnce(["0", ["key1"]])
				.mockResolvedValueOnce(["0", []]);
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(3600);
			const result = await service.cleanupOldKeys("key*", 86400);
			expect(result).toBe(0);
			expect(mockRedis.del).not.toHaveBeenCalled();
		});

		it("should not cleanup keys without TTL when idleTime <= maxAge", async () => {
			(mockRedis.scan as jest.Mock)
				.mockResolvedValueOnce(["0", ["key1"]])
				.mockResolvedValueOnce(["0", []]);
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(-1);
			(mockRedis.object as jest.Mock).mockResolvedValueOnce(3600);
			const result = await service.cleanupOldKeys("key*", 86400);
			expect(result).toBe(0);
			expect(mockRedis.del).not.toHaveBeenCalled();
		});

		it("should throw RedisClientError on scan error", async () => {
			(mockRedis.scan as jest.Mock).mockRejectedValueOnce(new Error("scan error"));
			await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(RedisClientError);
		});

		it("should iterate scan multiple times when cursor non-zero", async () => {
			(mockRedis.scan as jest.Mock)
				.mockResolvedValueOnce(["5", ["key1"]])
				.mockResolvedValueOnce(["0", []]);
			(mockRedis.ttl as jest.Mock).mockResolvedValueOnce(100000);
			(mockRedis.del as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.cleanupOldKeys("key*", 86400);
			expect(result).toBe(1);
			expect(mockRedis.scan).toHaveBeenCalledTimes(2);
		});

		it("should rethrow RedisClientError in cleanupOldKeys", async () => {
			const LoggerService = (await import("@makebelieve21213-packages/logger")).LoggerService;
			const redisErr = new RedisClientError(
				"test",
				new Error("x"),
				new LoggerService({} as { serviceName: string })
			);
			(mockRedis.scan as jest.Mock).mockRejectedValueOnce(redisErr);
			await expect(service.cleanupOldKeys("key*", 86400)).rejects.toThrow(redisErr);
		});
	});

	describe("client not initialized", () => {
		it("should throw for get", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.get("key")).rejects.toThrow(RedisClientError);
		});

		it("should throw for del", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.del("key")).rejects.toThrow(RedisClientError);
		});

		it("should throw for scan", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.scan(0)).rejects.toThrow(RedisClientError);
		});
	});
});
