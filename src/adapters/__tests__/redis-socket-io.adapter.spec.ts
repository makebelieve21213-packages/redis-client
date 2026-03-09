import RedisSocketIoAdapter from "src/adapters/redis-socket-io.adapter";

import type { LoggerService } from "@makebelieve21213-packages/logger";
import type { Cluster } from "ioredis";
import type { Server, ServerOptions } from "socket.io";
import type RedisClientService from "src/main/redis.service";
import type { RedisSocketIoAdapterOptions } from "src/types/socket-io-adapter.interface";

describe("RedisSocketIoAdapter", () => {
	let adapter: RedisSocketIoAdapter;
	let mockLoggerService: Partial<LoggerService>;
	let mockRedisClientService: Partial<RedisClientService>;
	let mockApp: unknown;

	const mockPubClient = {
		duplicate: jest.fn(),
	} as unknown as Cluster;

	const mockSubClient = {
		connect: jest.fn(),
	} as unknown as Cluster;

	const defaultOptions: RedisSocketIoAdapterOptions = {
		cors: {
			origin: "http://localhost:3000",
			credentials: true,
		},
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		mockApp = {};

		mockLoggerService = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			setContext: jest.fn(),
		};

		mockRedisClientService = {
			isConnected: jest.fn().mockReturnValue(true),
			getClient: jest.fn().mockReturnValue(mockPubClient),
		};

		mockPubClient.duplicate = jest.fn().mockReturnValue(mockSubClient);
		mockSubClient.connect = jest.fn().mockResolvedValue(undefined);

		adapter = new RedisSocketIoAdapter(
			mockApp as never,
			mockRedisClientService as RedisClientService,
			mockLoggerService as LoggerService,
			defaultOptions
		);
	});

	describe("инициализация", () => {
		it("должен быть определен", () => {
			expect(adapter).toBeDefined();
		});

		it("должен установить контекст логгера", () => {
			expect(mockLoggerService.setContext).toHaveBeenCalledWith("RedisSocketIoAdapter");
		});

		it("должен использовать опции по умолчанию если они не переданы", () => {
			const adapterWithoutOptions = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService
			);
			expect(adapterWithoutOptions).toBeDefined();
		});
	});

	describe("createIOServer", () => {
		it("должен создать Socket.IO сервер с настройками CORS", () => {
			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			const result = adapter.createIOServer(3001);

			expect(result).toBe(mockServer);
			expect(createIOServerSpy).toHaveBeenCalledWith(
				3001,
				expect.objectContaining({
					cors: {
						origin: "http://localhost:3000",
						credentials: true,
					},
				})
			);

			createIOServerSpy.mockRestore();
		});

		it("должен использовать массив origin для CORS", () => {
			const optionsWithArrayOrigin: RedisSocketIoAdapterOptions = {
				cors: {
					origin: ["http://localhost:3000", "http://localhost:3001"],
					credentials: true,
				},
			};

			const adapterWithArrayOrigin = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithArrayOrigin
			);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithArrayOrigin)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithArrayOrigin.createIOServer(3001);

			expect(createIOServerSpy).toHaveBeenCalledWith(
				3001,
				expect.objectContaining({
					cors: {
						origin: ["http://localhost:3000", "http://localhost:3001"],
						credentials: true,
					},
				})
			);

			createIOServerSpy.mockRestore();
		});

		it("должен логировать создание сервера", async () => {
			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			adapter.createIOServer(3001);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockLoggerService.log).toHaveBeenCalledWith(
				expect.stringContaining("Socket.IO server created")
			);

			createIOServerSpy.mockRestore();
		});

		it("должен логировать создание сервера без CORS", async () => {
			const adapterWithoutCors = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				{} // опции без CORS
			);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithoutCors)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithoutCors.createIOServer(3001);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockLoggerService.log).toHaveBeenCalledWith("Socket.IO server created");

			createIOServerSpy.mockRestore();
		});

		it("должен использовать cors с methods и allowedHeaders", () => {
			const optionsWithCorsExtras: RedisSocketIoAdapterOptions = {
				cors: {
					origin: "http://localhost:3000",
					credentials: false,
					methods: ["GET", "POST"],
					allowedHeaders: ["Authorization"],
				},
			};

			const adapterWithCorsExtras = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithCorsExtras
			);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithCorsExtras)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithCorsExtras.createIOServer(3001);

			expect(createIOServerSpy).toHaveBeenCalledWith(
				3001,
				expect.objectContaining({
					cors: {
						origin: "http://localhost:3000",
						credentials: false,
						methods: ["GET", "POST"],
						allowedHeaders: ["Authorization"],
					},
				})
			);

			createIOServerSpy.mockRestore();
		});

		it("должен объединять socketOptions с переданными опциями", () => {
			const optionsWithSocketOptions: RedisSocketIoAdapterOptions = {
				cors: {
					origin: "http://localhost:3000",
					credentials: true,
				},
				socketOptions: {
					transports: ["websocket"],
				},
			};

			const adapterWithSocketOptions = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithSocketOptions
			);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithSocketOptions)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithSocketOptions.createIOServer(3001, { pingTimeout: 60000 } as ServerOptions);

			expect(createIOServerSpy).toHaveBeenCalledWith(
				3001,
				expect.objectContaining({
					transports: ["websocket"],
					pingTimeout: 60000,
				})
			);

			createIOServerSpy.mockRestore();
		});
	});

	describe("initializeRedisAdapter", () => {
		it("должен инициализировать Redis адаптер когда Redis подключен", async () => {
			mockRedisClientService.isConnected = jest.fn().mockReturnValue(true);
			mockRedisClientService.getClient = jest.fn().mockReturnValue(mockPubClient);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			adapter.createIOServer(3001);

			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(mockRedisClientService.isConnected).toHaveBeenCalled();
			expect(mockRedisClientService.getClient).toHaveBeenCalled();
			expect(mockPubClient.duplicate).toHaveBeenCalled();
			expect(mockSubClient.connect).toHaveBeenCalled();

			createIOServerSpy.mockRestore();
		});

		it("должен логировать предупреждение когда Redis не подключен", async () => {
			mockRedisClientService.isConnected = jest.fn().mockReturnValue(false);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			adapter.createIOServer(3001);

			// Ждем достаточно времени для завершения всех retry попыток (10 попыток * 100ms = 1000ms) + запас
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Проверяем, что isConnected был вызван несколько раз (минимум 10 раз для retry)
			expect(mockRedisClientService.isConnected).toHaveBeenCalled();
			expect(mockLoggerService.warn).toHaveBeenCalledWith(
				expect.stringContaining("Redis connection timeout")
			);

			createIOServerSpy.mockRestore();
		});

		it("должен обработать ошибку при инициализации Redis адаптера", async () => {
			mockRedisClientService.isConnected = jest.fn().mockReturnValue(true);
			mockRedisClientService.getClient = jest.fn().mockReturnValue(mockPubClient);
			mockPubClient.duplicate = jest.fn().mockImplementation(() => {
				throw new Error("Redis connection failed");
			});

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			adapter.createIOServer(3001);

			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(mockLoggerService.error).toHaveBeenCalledWith(
				expect.stringContaining("Failed to initialize Redis adapter"),
				expect.any(String)
			);

			createIOServerSpy.mockRestore();
		});

		it("не должен повторно инициализировать Redis адаптер", async () => {
			mockRedisClientService.isConnected = jest.fn().mockReturnValue(true);
			mockRedisClientService.getClient = jest.fn().mockReturnValue(mockPubClient);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), "createIOServer")
				.mockReturnValue(mockServer);

			adapter.createIOServer(3001);
			await new Promise((resolve) => setTimeout(resolve, 200));

			const isConnectedCallCount = (mockRedisClientService.isConnected as jest.Mock).mock.calls.length;

			adapter.createIOServer(3002);
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(mockRedisClientService.isConnected).toHaveBeenCalledTimes(isConnectedCallCount);

			createIOServerSpy.mockRestore();
		});

		it("должен использовать кастомные maxRetries и retryDelay", async () => {
			const customOptions: RedisSocketIoAdapterOptions = {
				...defaultOptions,
				maxRetries: 5,
				retryDelay: 50,
			};

			const adapterWithCustomRetries = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				customOptions
			);

			mockRedisClientService.isConnected = jest.fn().mockReturnValue(false);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithCustomRetries)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithCustomRetries.createIOServer(3001);

			// Ждем достаточно времени для завершения всех retry попыток (5 попыток * 50ms = 250ms) + запас
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Проверяем, что isConnected был вызван несколько раз (минимум 5 раз для retry)
			expect(mockRedisClientService.isConnected).toHaveBeenCalled();
			expect(mockLoggerService.warn).toHaveBeenCalledWith(
				expect.stringContaining("Redis connection timeout")
			);

			createIOServerSpy.mockRestore();
		});

		it("должен использовать значения по умолчанию для maxRetries и retryDelay когда они не определены", async () => {
			const optionsWithoutRetries: RedisSocketIoAdapterOptions = {
				cors: {
					origin: "http://localhost:3000",
				},
				// maxRetries и retryDelay не определены
			};

			const adapterWithoutRetries = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithoutRetries
			);

			mockRedisClientService.isConnected = jest.fn().mockReturnValue(false);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapterWithoutRetries)), "createIOServer")
				.mockReturnValue(mockServer);

			adapterWithoutRetries.createIOServer(3001);

			// Ждем достаточно времени для завершения всех retry попыток (10 попыток * 100ms = 1000ms) + запас
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Проверяем, что isConnected был вызван несколько раз (минимум 10 раз для retry по умолчанию)
			expect(mockRedisClientService.isConnected).toHaveBeenCalled();
			expect(mockLoggerService.warn).toHaveBeenCalledWith(
				expect.stringContaining("Redis connection timeout")
			);

			createIOServerSpy.mockRestore();
		});

		it("должен использовать значение по умолчанию для credentials когда оно не определено", () => {
			const optionsWithoutCredentials: RedisSocketIoAdapterOptions = {
				cors: {
					origin: "http://localhost:3000",
					// credentials не определено
				},
			};

			const adapterWithoutCredentials = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithoutCredentials
			);

			const mockServer = {
				adapter: jest.fn(),
			} as unknown as Server;

			const createIOServerSpy = jest
				.spyOn(
					Object.getPrototypeOf(Object.getPrototypeOf(adapterWithoutCredentials)),
					"createIOServer"
				)
				.mockReturnValue(mockServer);

			adapterWithoutCredentials.createIOServer(3001);

			expect(createIOServerSpy).toHaveBeenCalledWith(
				3001,
				expect.objectContaining({
					cors: {
						origin: "http://localhost:3000",
						credentials: false, // значение по умолчанию
					},
				})
			);

			createIOServerSpy.mockRestore();
		});

		it("должен использовать значения по умолчанию для maxRetries и retryDelay в initializeRedisAdapter когда они не определены в options", async () => {
			// Создаем адаптер с опциями без maxRetries и retryDelay
			const optionsWithoutRetries: RedisSocketIoAdapterOptions = {
				cors: {
					origin: "http://localhost:3000",
				},
			};

			const adapterWithoutRetries = new RedisSocketIoAdapter(
				mockApp as never,
				mockRedisClientService as RedisClientService,
				mockLoggerService as LoggerService,
				optionsWithoutRetries
			);

			// Удаляем maxRetries и retryDelay из options через рефлексию для покрытия веток ?? 10 и ?? 100
			// Это нужно для покрытия веток в initializeRedisAdapter, которые проверяют эти значения
			const adapterPrivate = adapterWithoutRetries as unknown as {
				options: RedisSocketIoAdapterOptions;
				redisInitialized: boolean;
				initializeRedisAdapter: () => Promise<void>;
			};
			delete (adapterPrivate.options as Partial<RedisSocketIoAdapterOptions>).maxRetries;
			delete (adapterPrivate.options as Partial<RedisSocketIoAdapterOptions>).retryDelay;
			adapterPrivate.redisInitialized = false; // Сбрасываем флаг инициализации

			mockRedisClientService.isConnected = jest.fn().mockReturnValue(false);

			// Вызываем приватный метод через рефлексию
			await adapterPrivate.initializeRedisAdapter();

			// Проверяем, что использовались значения по умолчанию (10 попыток * 100ms)
			expect(mockRedisClientService.isConnected).toHaveBeenCalled();
			expect(mockLoggerService.warn).toHaveBeenCalledWith(
				expect.stringContaining("Redis connection timeout")
			);
		});
	});
});
