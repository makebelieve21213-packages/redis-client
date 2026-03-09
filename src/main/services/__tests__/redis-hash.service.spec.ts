import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisHashService from "src/main/services/redis-hash.service";
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

describe("RedisHashService", () => {
	let service: RedisHashService;
	let connectionService: RedisConnectionService;
	let mockRedis: jest.Mocked<Redis>;
	let mockLogger: LoggerService;

	beforeEach(async () => {
		mockLogger = new LoggerService({} as { serviceName: string });
		RedisConnectionService.resetInstance();

		mockRedis = {
			connect: jest.fn().mockResolvedValue(undefined),
			quit: jest.fn().mockResolvedValue("OK"),
			on: jest.fn().mockReturnThis(),
			status: "ready",
			hset: jest.fn(),
			hget: jest.fn(),
			hgetall: jest.fn(),
			hdel: jest.fn(),
			hexists: jest.fn(),
			hscan: jest.fn(),
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
				RedisHashService,
			],
		}).compile();

		connectionService = module.get<RedisConnectionService>(RedisConnectionService);
		service = module.get<RedisHashService>(RedisHashService);

		await connectionService.onModuleInit();
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("hset", () => {
		it("should set field in hash", async () => {
			(mockRedis.hset as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.hset("hash:key", "field", "value");
			expect(mockRedis.hset).toHaveBeenCalledWith("hash:key", "field", "value");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hset as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hset("hash:key", "field", "value")).rejects.toThrow(RedisClientError);
		});
	});

	describe("hget", () => {
		it("should get field value", async () => {
			(mockRedis.hget as jest.Mock).mockResolvedValueOnce("value");
			const result = await service.hget("hash:key", "field");
			expect(mockRedis.hget).toHaveBeenCalledWith("hash:key", "field");
			expect(result).toBe("value");
		});

		it("should return null when field missing", async () => {
			(mockRedis.hget as jest.Mock).mockResolvedValueOnce(null);
			expect(await service.hget("hash:key", "field")).toBeNull();
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hget as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hget("hash:key", "field")).rejects.toThrow(RedisClientError);
		});
	});

	describe("hgetall", () => {
		it("should get all fields", async () => {
			const hash = { f1: "v1", f2: "v2" };
			(mockRedis.hgetall as jest.Mock).mockResolvedValueOnce(hash);
			const result = await service.hgetall("hash:key");
			expect(mockRedis.hgetall).toHaveBeenCalledWith("hash:key");
			expect(result).toEqual(hash);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hgetall as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hgetall("hash:key")).rejects.toThrow(RedisClientError);
		});
	});

	describe("hdel", () => {
		it("should delete field", async () => {
			(mockRedis.hdel as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.hdel("hash:key", "field");
			expect(mockRedis.hdel).toHaveBeenCalledWith("hash:key", "field");
			expect(result).toBe(1);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hdel as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hdel("hash:key", "field")).rejects.toThrow(RedisClientError);
		});
	});

	describe("hexists", () => {
		it("should return 1 when field exists", async () => {
			(mockRedis.hexists as jest.Mock).mockResolvedValueOnce(1);
			const result = await service.hexists("hash:key", "field");
			expect(mockRedis.hexists).toHaveBeenCalledWith("hash:key", "field");
			expect(result).toBe(1);
		});

		it("should return 0 when field does not exist", async () => {
			(mockRedis.hexists as jest.Mock).mockResolvedValueOnce(0);
			const result = await service.hexists("hash:key", "field");
			expect(result).toBe(0);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hexists as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hexists("hash:key", "field")).rejects.toThrow(RedisClientError);
		});
	});

	describe("hscan", () => {
		it("should scan with cursor only", async () => {
			(mockRedis.hscan as jest.Mock).mockResolvedValueOnce(["0", ["f1", "v1"]]);
			const result = await service.hscan("hash:key", 0);
			expect(mockRedis.hscan).toHaveBeenCalledWith("hash:key", 0);
			expect(result).toEqual(["0", ["f1", "v1"]]);
		});

		it("should scan with pattern", async () => {
			(mockRedis.hscan as jest.Mock).mockResolvedValueOnce(["0", ["f1", "v1"]]);
			const result = await service.hscan("hash:key", 0, "f*");
			expect(mockRedis.hscan).toHaveBeenCalledWith("hash:key", 0, "MATCH", "f*");
			expect(result).toEqual(["0", ["f1", "v1"]]);
		});

		it("should scan with pattern and count", async () => {
			(mockRedis.hscan as jest.Mock).mockResolvedValueOnce(["0", ["f1", "v1"]]);
			const result = await service.hscan("hash:key", 0, "f*", 10);
			expect(mockRedis.hscan).toHaveBeenCalledWith("hash:key", 0, "MATCH", "f*", "COUNT", 10);
			expect(result).toEqual(["0", ["f1", "v1"]]);
		});

		it("should scan with count only (no pattern)", async () => {
			(mockRedis.hscan as jest.Mock).mockResolvedValueOnce(["0", ["f1", "v1"]]);
			const result = await service.hscan("hash:key", 0, undefined, 20);
			expect(mockRedis.hscan).toHaveBeenCalledWith("hash:key", 0, "COUNT", 20);
			expect(result).toEqual(["0", ["f1", "v1"]]);
		});

		it("should scan with pattern but not add COUNT when count is 0", async () => {
			(mockRedis.hscan as jest.Mock).mockResolvedValueOnce(["0", ["f1", "v1"]]);
			const result = await service.hscan("hash:key", 0, "f*", 0);
			expect(mockRedis.hscan).toHaveBeenCalledWith("hash:key", 0, "MATCH", "f*");
			expect(result).toEqual(["0", ["f1", "v1"]]);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.hscan as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.hscan("hash:key", 0)).rejects.toThrow(RedisClientError);
		});
	});

	describe("client not initialized", () => {
		it("should throw for hset", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hset("k", "f", "v")).rejects.toThrow(RedisClientError);
		});

		it("should throw for hget", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hget("k", "f")).rejects.toThrow(RedisClientError);
		});

		it("should throw for hgetall", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hgetall("k")).rejects.toThrow(RedisClientError);
		});

		it("should throw for hdel", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hdel("k", "f")).rejects.toThrow(RedisClientError);
		});

		it("should throw for hexists", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hexists("k", "f")).rejects.toThrow(RedisClientError);
		});

		it("should throw for hscan", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.hscan("k", 0)).rejects.toThrow(RedisClientError);
		});
	});
});
