import { LoggerService } from "@makebelieve21213-packages/logger";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import RedisClientError from "src/errors/redis.error";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisStreamService from "src/main/services/redis-stream.service";
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

describe("RedisStreamService", () => {
	let service: RedisStreamService;
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
			xadd: jest.fn(),
			xread: jest.fn(),
			xtrim: jest.fn(),
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
				RedisStreamService,
			],
		}).compile();

		connectionService = module.get<RedisConnectionService>(RedisConnectionService);
		service = module.get<RedisStreamService>(RedisStreamService);

		await connectionService.onModuleInit();
	});

	afterEach(() => {
		jest.clearAllMocks();
		RedisConnectionService.resetInstance();
	});

	describe("xadd", () => {
		it("should add entry to stream", async () => {
			(mockRedis.xadd as jest.Mock).mockResolvedValueOnce("1234-0");
			const result = await service.xadd("stream:key", "*", { f1: "v1", f2: "v2" });
			expect(mockRedis.xadd).toHaveBeenCalledWith("stream:key", "*", "f1", "v1", "f2", "v2");
			expect(result).toBe("1234-0");
		});

		it("should add entry with single field", async () => {
			(mockRedis.xadd as jest.Mock).mockResolvedValueOnce("1234-0");
			const result = await service.xadd("stream:key", "1-0", { only: "field" });
			expect(mockRedis.xadd).toHaveBeenCalledWith("stream:key", "1-0", "only", "field");
			expect(result).toBe("1234-0");
		});

		it("should add entry with empty fields object", async () => {
			(mockRedis.xadd as jest.Mock).mockResolvedValueOnce("1234-0");
			const result = await service.xadd("stream:key", "*", {});
			expect(mockRedis.xadd).toHaveBeenCalledWith("stream:key", "*");
			expect(result).toBe("1234-0");
		});

		it("should rethrow RedisClientError", async () => {
			const LoggerService = (await import("@makebelieve21213-packages/logger")).LoggerService;
			const redisErr = new RedisClientError(
				"x",
				new Error("y"),
				new LoggerService({} as { serviceName: string })
			);
			(mockRedis.xadd as jest.Mock).mockRejectedValueOnce(redisErr);
			await expect(service.xadd("k", "*", { f: "v" })).rejects.toThrow(redisErr);
		});

		it("should throw when xadd returns null", async () => {
			(mockRedis.xadd as jest.Mock).mockResolvedValueOnce(null);
			await expect(service.xadd("stream:key", "*", { f1: "v1" })).rejects.toThrow(RedisClientError);
		});

		it("should throw on Redis error", async () => {
			(mockRedis.xadd as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.xadd("stream:key", "*", { f1: "v1" })).rejects.toThrow(RedisClientError);
		});
	});

	describe("xread", () => {
		it("should read with count", async () => {
			const raw: Array<[string, Array<[string, string[]]>]> = [
				["stream:key", [["1234-0", ["f1", "v1", "f2", "v2"]]]],
			];
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(raw);
			const result = await service.xread([{ key: "stream:key", id: "0" }], 10);
			expect(result).toEqual([
				{
					key: "stream:key",
					messages: [{ id: "1234-0", fields: { f1: "v1", f2: "v2" } }],
				},
			]);
		});

		it("should return null when no entries", async () => {
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(null);
			const result = await service.xread([{ key: "stream:key", id: "0" }]);
			expect(result).toBeNull();
		});

		it("should read without count", async () => {
			const raw: Array<[string, Array<[string, string[]]>]> = [
				["stream:key", [["1234-0", ["f1", "v1"]]]],
			];
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(raw);
			const result = await service.xread([{ key: "stream:key", id: "0" }]);
			expect(result).toEqual([
				{
					key: "stream:key",
					messages: [{ id: "1234-0", fields: { f1: "v1" } }],
				},
			]);
		});

		it("should read with count 0", async () => {
			const raw: Array<[string, Array<[string, string[]]>]> = [
				["stream:key", [["1234-0", ["f1", "v1"]]]],
			];
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(raw);
			const result = await service.xread([{ key: "stream:key", id: "0" }], 0);
			expect(mockRedis.xread).toHaveBeenCalledWith("COUNT", 0, "STREAMS", "stream:key", "0");
			expect(result).toEqual([
				{
					key: "stream:key",
					messages: [{ id: "1234-0", fields: { f1: "v1" } }],
				},
			]);
		});

		it("should read message with empty fields", async () => {
			const raw: Array<[string, Array<[string, string[]]>]> = [["stream:key", [["1234-0", []]]]];
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(raw);
			const result = await service.xread([{ key: "stream:key", id: "0" }]);
			expect(result).toEqual([{ key: "stream:key", messages: [{ id: "1234-0", fields: {} }] }]);
		});

		it("should throw on Redis error", async () => {
			(mockRedis.xread as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.xread([{ key: "stream:key", id: "0" }])).rejects.toThrow(RedisClientError);
		});

		it("should rethrow RedisClientError", async () => {
			const LoggerService = (await import("@makebelieve21213-packages/logger")).LoggerService;
			const redisErr = new RedisClientError(
				"x",
				new Error("y"),
				new LoggerService({} as { serviceName: string })
			);
			(mockRedis.xread as jest.Mock).mockRejectedValueOnce(redisErr);
			await expect(service.xread([{ key: "k", id: "0" }])).rejects.toThrow(redisErr);
		});

		it("should read multiple streams", async () => {
			const raw: Array<[string, Array<[string, string[]]>]> = [
				["stream1", [["1-0", ["f", "v"]]]],
				["stream2", [["2-0", ["a", "b"]]]],
			];
			(mockRedis.xread as jest.Mock).mockResolvedValueOnce(raw);
			const result = await service.xread(
				[
					{ key: "stream1", id: "0" },
					{ key: "stream2", id: "0" },
				],
				5
			);
			expect(result).toHaveLength(2);
		});
	});

	describe("xtrim", () => {
		it("should trim stream", async () => {
			(mockRedis.xtrim as jest.Mock).mockResolvedValueOnce(5);
			const result = await service.xtrim("stream:key", 100);
			expect(mockRedis.xtrim).toHaveBeenCalledWith("stream:key", "MAXLEN", "~", 100);
			expect(result).toBe(5);
		});

		it("should throw RedisClientError on error", async () => {
			(mockRedis.xtrim as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));
			await expect(service.xtrim("stream:key", 100)).rejects.toThrow(RedisClientError);
		});
	});

	describe("client not initialized", () => {
		it("should throw for xadd", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.xadd("k", "*", { f: "v" })).rejects.toThrow(RedisClientError);
		});

		it("should throw for xread", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.xread([{ key: "k", id: "0" }])).rejects.toThrow(RedisClientError);
		});

		it("should throw for xtrim", async () => {
			RedisConnectionService.resetInstance();
			await expect(service.xtrim("k", 100)).rejects.toThrow(RedisClientError);
		});
	});
});
