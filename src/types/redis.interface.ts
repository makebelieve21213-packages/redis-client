import type Redis from "ioredis";
import type { RedisStreamReadResult } from "src/types/redis-stream.types";

// Интерфейс для Redis клиента
export default interface RedisClientContract {
	// Получить значение по ключу
	get(key: string): Promise<string | null>;

	// Установить значение по ключу
	set(key: string, value: string, ttlSeconds?: number): Promise<void>;

	// Удалить ключ
	del(key: string): Promise<number>;

	// Получить TTL ключа в секундах
	ttl(key: string): Promise<number>;

	// Сформировать ключ с userId
	makeUserKey(userId: string, key: string): string;

	// Проверить подключение к Redis
	isConnected(): boolean;

	// Отключиться от Redis
	disconnect(): Promise<void>;

	// Получить raw ioredis клиент для продвинутого использования
	getClient(): Redis;

	// Hash методы

	// Установить поле в Hash
	hset(key: string, field: string, value: string): Promise<number>;

	// Получить поле из Hash
	hget(key: string, field: string): Promise<string | null>;

	// Получить все поля из Hash
	hgetall(key: string): Promise<Record<string, string>>;

	// Удалить поле из Hash
	hdel(key: string, field: string): Promise<number>;

	// Проверить существование поля в Hash
	hexists(key: string, field: string): Promise<number>;

	// Сканировать Hash
	hscan(key: string, cursor: number, pattern?: string, count?: number): Promise<[string, string[]]>;

	// Sorted Set методы

	// Добавить элемент в Sorted Set
	zadd(key: string, score: number, member: string): Promise<number>;

	// Получить элементы по диапазону
	zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>;

	// Удалить элемент из Sorted Set
	zrem(key: string, member: string): Promise<number>;

	// Удалить элементы по score диапазону
	zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;

	// Получить score элемента
	zscore(key: string, member: string): Promise<string | null>;

	// Set методы

	// Добавить элемент в Set
	sadd(key: string, member: string): Promise<number>;

	// Получить все элементы Set
	smembers(key: string): Promise<string[]>;

	// Удалить элемент из Set
	srem(key: string, member: string): Promise<number>;

	// Проверить существование элемента в Set
	sismember(key: string, member: string): Promise<number>;

	// Redis Streams методы

	// Добавить запись в Stream
	xadd(key: string, id: string, fields: Record<string, string>): Promise<string>;

	// Прочитать записи из Stream
	xread(
		streams: Array<{ key: string; id: string }>,
		count?: number
	): Promise<RedisStreamReadResult[] | null>;

	// Обрезать Stream до maxlen
	xtrim(key: string, maxlen: number): Promise<number>;

	// Очистка методы
	// Сканировать ключи по паттерну
	scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]>;

	// Очистить старые ключи по паттерну
	cleanupOldKeys(pattern: string, maxAgeSeconds: number): Promise<number>;
}
