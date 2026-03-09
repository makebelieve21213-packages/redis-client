import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import RedisConnectionService from "src/main/services/redis-connection.service";
import RedisHashService from "src/main/services/redis-hash.service";
import RedisKeyService from "src/main/services/redis-key.service";
import RedisSetService from "src/main/services/redis-set.service";
import RedisSortedSetService from "src/main/services/redis-sorted-set.service";
import RedisStreamService from "src/main/services/redis-stream.service";

import type { RedisStreamReadResult } from "src/types/redis-stream.types";
import type RedisClientContract from "src/types/redis.interface";

// Сервис фасад, реализующий методы
@Injectable()
export default class RedisClientService implements RedisClientContract {
	constructor(
		private readonly connection: RedisConnectionService,
		private readonly keyService: RedisKeyService,
		private readonly hashService: RedisHashService,
		private readonly sortedSetService: RedisSortedSetService,
		private readonly setService: RedisSetService,
		private readonly streamService: RedisStreamService
	) {}

	getClient(): Redis {
		return this.connection.getClient();
	}

	async get(key: string): Promise<string | null> {
		return this.keyService.get(key);
	}

	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		return this.keyService.set(key, value, ttlSeconds);
	}

	async del(key: string): Promise<number> {
		return this.keyService.del(key);
	}

	async ttl(key: string): Promise<number> {
		return this.keyService.ttl(key);
	}

	makeUserKey(userId: string, key: string): string {
		return this.keyService.makeUserKey(userId, key);
	}

	isConnected(): boolean {
		return this.connection.isConnected();
	}

	async disconnect(): Promise<void> {
		return this.connection.disconnect();
	}

	async hset(key: string, field: string, value: string): Promise<number> {
		return this.hashService.hset(key, field, value);
	}

	async hget(key: string, field: string): Promise<string | null> {
		return this.hashService.hget(key, field);
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		return this.hashService.hgetall(key);
	}

	async hdel(key: string, field: string): Promise<number> {
		return this.hashService.hdel(key, field);
	}

	async hexists(key: string, field: string): Promise<number> {
		return this.hashService.hexists(key, field);
	}

	async hscan(
		key: string,
		cursor: number,
		pattern?: string,
		count?: number
	): Promise<[string, string[]]> {
		return this.hashService.hscan(key, cursor, pattern, count);
	}

	async zadd(key: string, score: number, member: string): Promise<number> {
		return this.sortedSetService.zadd(key, score, member);
	}

	async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
		return this.sortedSetService.zrange(key, start, stop, withScores);
	}

	async zrem(key: string, member: string): Promise<number> {
		return this.sortedSetService.zrem(key, member);
	}

	async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
		return this.sortedSetService.zremrangebyscore(key, min, max);
	}

	async zscore(key: string, member: string): Promise<string | null> {
		return this.sortedSetService.zscore(key, member);
	}

	async sadd(key: string, member: string): Promise<number> {
		return this.setService.sadd(key, member);
	}

	async smembers(key: string): Promise<string[]> {
		return this.setService.smembers(key);
	}

	async srem(key: string, member: string): Promise<number> {
		return this.setService.srem(key, member);
	}

	async sismember(key: string, member: string): Promise<number> {
		return this.setService.sismember(key, member);
	}

	async xadd(key: string, id: string, fields: Record<string, string>): Promise<string> {
		return this.streamService.xadd(key, id, fields);
	}

	async xread(
		streams: Array<{ key: string; id: string }>,
		count?: number
	): Promise<RedisStreamReadResult[] | null> {
		return this.streamService.xread(streams, count);
	}

	async xtrim(key: string, maxlen: number): Promise<number> {
		return this.streamService.xtrim(key, maxlen);
	}

	async scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]> {
		return this.keyService.scan(cursor, pattern, count);
	}

	async cleanupOldKeys(pattern: string, maxAgeSeconds: number): Promise<number> {
		return this.keyService.cleanupOldKeys(pattern, maxAgeSeconds);
	}
}
