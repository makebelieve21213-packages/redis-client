import type { ServerOptions } from "socket.io";

// Опции для Redis Socket.IO адаптера
export interface RedisSocketIoAdapterOptions {
	// CORS настройки для Socket.IO сервера
	cors?: {
		// Разрешенные origin'ы (строка или массив строк)
		origin: string | string[];
		// Разрешить credentials
		credentials?: boolean;
		// Дополнительные CORS опции
		methods?: string[];
		allowedHeaders?: string[];
	};
	// Дополнительные опции Socket.IO сервера
	socketOptions?: Partial<ServerOptions>;
	// Максимальное количество попыток подключения к Redis (по умолчанию 10)
	maxRetries?: number;
	// Задержка между попытками подключения в миллисекундах (по умолчанию 100)
	retryDelay?: number;
}
