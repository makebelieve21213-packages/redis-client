import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from "@nestjs/common";
import type { RedisOptions } from "ioredis";

// Опции конфигурации для Redis Client модуля
export interface RedisClientModuleOptions {
	// Хост Redis сервера
	host: string;
	// Порт Redis сервера
	port: number;
	// Пароль для аутентификации (опционально)
	password?: string;
	// Номер базы данных Redis (0-15, по умолчанию 0)
	db?: number;
	// Дополнительные опции ioredis
	options?: Partial<RedisOptions>;
}

// Тип для функции фабрики с динамическими аргументами
type RedisModuleOptionsFactory<T extends unknown[] = []> = (
	...args: T
) => Promise<RedisClientModuleOptions> | RedisClientModuleOptions;

// Асинхронные опции для динамической конфигурации модуля через useFactory
export interface RedisClientModuleAsyncOptions<T extends unknown[] = []>
	extends Pick<ModuleMetadata, "imports"> {
	/**
	 * Фабрика для создания опций
	 * Аргументы функции соответствуют зависимостям из inject
	 */
	useFactory: RedisModuleOptionsFactory<T>;
	// Зависимости для инъекции в useFactory
	inject?: (InjectionToken | OptionalFactoryDependency)[];
}
