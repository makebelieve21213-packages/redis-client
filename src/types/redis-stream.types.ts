export interface RedisStreamMessage {
	id: string;
	fields: Record<string, string>;
}

export interface RedisStreamReadResult {
	key: string;
	messages: RedisStreamMessage[];
}
