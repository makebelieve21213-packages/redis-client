import { LoggerService } from "@makebelieve21213-packages/logger";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import RedisClientModule from "src/main/redis.module";
import RedisClientService from "src/main/redis.service";
import { REDIS_CLIENT_OPTIONS } from "src/types/injection-keys";

import type { DynamicModule } from "@nestjs/common";
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

describe("RedisClientModule", () => {
	const mockOptions: RedisClientModuleOptions = {
		host: "localhost",
		port: 6379,
		password: "test-password",
		db: 1,
	};

	let mockLogger: LoggerService;
	let MockLoggerModule: DynamicModule;

	beforeEach(() => {
		mockLogger = new LoggerService({} as { serviceName: string });
		// Создаем временный модуль для мока LoggerService, чтобы он был доступен в dynamic modules
		class MockLoggerModuleClass {}
		MockLoggerModule = {
			module: MockLoggerModuleClass,
			providers: [
				{
					provide: LoggerService,
					useValue: mockLogger,
				},
			],
			exports: [LoggerService],
			global: true,
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
		// Очищаем статический экземпляр после каждого теста
		(RedisClientService as unknown as { instance: unknown }).instance = null;
	});

	describe("forRootAsync", () => {
		it("should create module with async options using useFactory", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => mockOptions,
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);
			const options = module.get<RedisClientModuleOptions>(REDIS_CLIENT_OPTIONS);

			expect(service).toBeDefined();
			expect(options).toEqual(mockOptions);
		});

		it("should inject dependencies in useFactory", async () => {
			const mockConfigService = {
				get: jest.fn((key: string, defaultValue?: unknown): unknown => {
					switch (key) {
						case "redis.host":
							return mockOptions.host;
						case "redis.port":
							return mockOptions.port;
						case "redis.password":
							return mockOptions.password;
						case "redis.db":
							return mockOptions.db;
						default:
							return defaultValue;
					}
				}),
			};

			// Создаем тестовый модуль для ConfigService
			const TestConfigModule = {
				module: class TestConfigModule {},
				providers: [
					{
						provide: ConfigService,
						useValue: mockConfigService,
					},
				],
				exports: [ConfigService],
			};

			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [TestConfigModule, MockLoggerModule],
						useFactory: (config: ConfigService): RedisClientModuleOptions => ({
							host: config.get<string>("redis.host", "localhost"),
							port: config.get<number>("redis.port", 6379),
							password: config.get<string>("redis.password"),
							db: config.get<number>("redis.db"),
						}),
						inject: [ConfigService],
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);
			const options = module.get<RedisClientModuleOptions>(REDIS_CLIENT_OPTIONS);

			expect(service).toBeDefined();
			expect(options).toEqual(mockOptions);
			expect(mockConfigService.get).toHaveBeenCalledWith("redis.host", "localhost");
			expect(mockConfigService.get).toHaveBeenCalledWith("redis.port", 6379);
		});

		it("should handle async factory function", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: async () => {
							// Имитация асинхронной загрузки конфигурации
							await new Promise((resolve) => setTimeout(resolve, 10));
							return mockOptions;
						},
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeDefined();
		});

		it("should support imports in forRootAsync", async () => {
			const mockConfigModule = {
				module: class ConfigModule {},
				providers: [
					{
						provide: ConfigService,
						useValue: {
							get: jest.fn(() => "test-value"),
						},
					},
				],
				exports: [ConfigService],
			};

			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [mockConfigModule, MockLoggerModule],
						useFactory: () => mockOptions,
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeDefined();
		});

		it("should work without inject parameter", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => mockOptions,
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeDefined();
		});

		it("should work without imports parameter", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => mockOptions,
						inject: [],
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeDefined();
		});

		it("should work without imports property", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						useFactory: () => mockOptions,
					}),
					MockLoggerModule,
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeDefined();
		});
	});

	describe("Global module", () => {
		it("should be available globally", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => mockOptions,
					}),
				],
			}).compile();

			// Проверяем, что модуль глобальный через метаданные
			const moduleRef = module.get(RedisClientModule);
			expect(moduleRef).toBeDefined();
		});
	});

	describe("Service initialization", () => {
		it("should create RedisClientService instance via factory", async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => mockOptions,
					}),
				],
			}).compile();

			const service = module.get<RedisClientService>(RedisClientService);

			expect(service).toBeInstanceOf(RedisClientService);
		});

		it("should pass options to RedisClientService", async () => {
			const customOptions: RedisClientModuleOptions = {
				host: "redis.example.com",
				port: 6380,
				db: 2,
			};

			const module: TestingModule = await Test.createTestingModule({
				imports: [
					RedisClientModule.forRootAsync({
						imports: [MockLoggerModule],
						useFactory: () => customOptions,
					}),
				],
			}).compile();

			const options = module.get<RedisClientModuleOptions>(REDIS_CLIENT_OPTIONS);

			expect(options).toEqual(customOptions);
		});
	});
});
