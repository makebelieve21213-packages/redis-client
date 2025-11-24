# @packages/redis-client

Легковесный Redis клиент для NestJS с паттерном Singleton, connection pooling и удобными методами для работы с кэшированием и масштабирования Socket.IO серверов.

## 📋 Содержание

- [Возможности](#-возможности)
- [Требования](#-требования)
- [Установка](#-установка)
- [Структура пакета](#-структура-пакета)
- [Быстрый старт](#-быстрый-старт)
- [Использование модулей и сервисов](#-использование-модулей-и-сервисов)
- [API Reference](#-api-reference)
- [Типы и интерфейсы](#-типы-и-интерфейсы)
- [Интеграция с Socket.IO](#-интеграция-с-socketio)
- [Troubleshooting](#-troubleshooting)
- [Тестирование](#-тестирование)

## 🚀 Возможности

- ✅ **Singleton pattern** - единый экземпляр Redis подключения для всего приложения
- ✅ **NestJS интеграция** - глобальный модуль с поддержкой `forRootAsync`
- ✅ **Type-safe API** - полная типобезопасность TypeScript
- ✅ **User-specific keys** - удобное формирование ключей с userId
- ✅ **TTL support** - поддержка автоматического истечения ключей
- ✅ **Socket.IO scaling** - поддержка Redis adapter для масштабирования
- ✅ **100% покрытие тестами** - надежность и качество кода
- ✅ **Graceful shutdown** - корректное отключение при остановке приложения
- ✅ **Богатый API** - поддержка Hash, Sorted Set, Set, Streams и других структур данных

## 📋 Требования

- **Node.js**: >= 22.11.0
- **NestJS**: >= 11.0.0
- **Redis**: >= 6.0.0 (через ioredis)

## 📦 Установка

```bash
npm install @packages/redis-client
```

### Зависимости

Пакет требует следующие peer dependencies:

```json
{
  "@nestjs/common": "^11.0.0",
  "@nestjs/config": "^3.0.0",
  "ioredis": "^5.0.0",
  "reflect-metadata": "^0.1.13 || ^0.2.0"
}
```

Для Socket.IO масштабирования дополнительно требуется:

```json
{
  "@socket.io/redis-adapter": "^8.0.0"
}
```

## 📁 Структура пакета

```
src/
├── main/                                 # Основная логика
│   ├── redis.module.ts                   # RedisClientModule - глобальный NestJS модуль
│   └── redis.service.ts                  # RedisClientService - Singleton сервис
│
├── adapters/                             # Адаптеры
│   └── redis-socket-io.adapter.ts        # RedisSocketIoAdapter для Socket.IO
│
├── types/                                # TypeScript типы и интерфейсы
│   ├── module-options.interface.ts       # Опции конфигурации модуля
│   ├── redis.interface.ts                # Интерфейс RedisClientContract
│   ├── socket-io-adapter.interface.ts    # Опции Socket.IO адаптера
│   └── injection-keys.ts                 # DI токены
│
├── errors/                               # Кастомные ошибки
│   └── redis.error.ts                    # RedisClientError
│
└── index.ts                              # Точка входа (экспорты)
```

## 🔧 Быстрый старт

### Шаг 1: Создайте конфигурацию Redis

```typescript
// src/configs/redis.config.ts
import { registerAs } from '@nestjs/config';
import type { RedisClientModuleOptions } from '@packages/redis-client';

export default registerAs(
  'redis',
  (): RedisClientModuleOptions => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  }),
);
```

### Шаг 2: Импортируйте модуль в AppModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientModule } from '@packages/redis-client';
import redisConfig from './configs/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [redisConfig],
      isGlobal: true,
    }),
    RedisClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('redis')!,
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Шаг 3: Используйте RedisClientService в сервисах

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { RedisClientService } from '@packages/redis-client';

@Injectable()
export class UserService {
  constructor(private readonly redisClient: RedisClientService) {}

  async cacheUserSession(userId: string, sessionData: string): Promise<void> {
    const key = this.redisClient.makeUserKey(userId, 'session');
    await this.redisClient.set(key, sessionData, 3600); // TTL 1 час
  }

  async getUserSession(userId: string): Promise<string | null> {
    const key = this.redisClient.makeUserKey(userId, 'session');
    return await this.redisClient.get(key);
  }

  async deleteUserSession(userId: string): Promise<void> {
    const key = this.redisClient.makeUserKey(userId, 'session');
    await this.redisClient.del(key);
  }
}
```

**Готово!** Модуль автоматически:
- Подключится к Redis при старте
- Создаст единое подключение для всего приложения
- Отключится при shutdown

## 📚 Использование модулей и сервисов

### RedisClientModule

**Назначение:** Глобальный модуль для единого подключения к Redis.

**Метод инициализации:**

#### `forRootAsync(options)`

```typescript
RedisClientModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    host: configService.get('REDIS_HOST'),
    port: configService.get('REDIS_PORT'),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get('REDIS_DB'),
  }),
  inject: [ConfigService],
  imports: [ConfigModule],
})
```

**Параметры:**
- `useFactory: (deps) => RedisClientModuleOptions` - фабрика для создания опций модуля
- `inject?: InjectionToken[]` - зависимости для инжекции в useFactory
- `imports?: Module[]` - дополнительные модули для DI

**Экспортирует:** `RedisClientService`

### RedisClientService

**Методы:**

#### Основные методы

##### `get(key: string): Promise<string | null>`

Получить значение по ключу.

```typescript
const value = await redisClient.get('my-key');
```

**Возвращает:**
- `string` - значение, если ключ существует
- `null` - если ключ не существует

##### `set(key: string, value: string, ttlSeconds?: number): Promise<void>`

Установить значение по ключу с опциональным TTL.

```typescript
// Без TTL (permanent)
await redisClient.set('my-key', 'my-value');

// С TTL 1 час
await redisClient.set('my-key', 'my-value', 3600);
```

##### `del(key: string): Promise<number>`

Удалить ключ.

```typescript
const deletedCount = await redisClient.del('my-key');
```

**Возвращает:**
- `1` - ключ был удален
- `0` - ключ не существовал

##### `ttl(key: string): Promise<number>`

Получить оставшееся время жизни ключа в секундах.

```typescript
const ttl = await redisClient.ttl('my-key');
```

**Возвращает:**
- Положительное число - оставшееся время в секундах
- `-1` - ключ существует, но без TTL (permanent)
- `-2` - ключ не существует

##### `makeUserKey(userId: string, key: string): string`

Сформировать ключ с префиксом userId.

```typescript
const key = redisClient.makeUserKey('user123', 'session');
// Результат: "user:user123:session"
```

**Формат:** `user:{userId}:{key}`

##### `getClient(): Redis`

Получить прямой доступ к экземпляру ioredis клиента (для продвинутых операций).

**⚠️ Внимание:** Используйте только если стандартных методов недостаточно. Для большинства операций используйте методы из `RedisClientService`.

```typescript
const client = redisClient.getClient();
// Используйте только если нужны операции, которых нет в RedisClientService
```

**Возвращает:**
- `Redis` - экземпляр ioredis клиента
- Выбрасывает `RedisClientError`, если клиент не инициализирован

##### `isConnected(): boolean`

Проверить подключение к Redis.

```typescript
if (redisClient.isConnected()) {
  console.log('Redis подключен');
}
```

##### `disconnect(): Promise<void>`

Отключиться от Redis (вызывается автоматически при shutdown).

```typescript
await redisClient.disconnect();
```

#### Hash методы

- `hset(key: string, field: string, value: string): Promise<number>` - установить поле в Hash
- `hget(key: string, field: string): Promise<string | null>` - получить поле из Hash
- `hgetall(key: string): Promise<Record<string, string>>` - получить все поля из Hash
- `hdel(key: string, field: string): Promise<number>` - удалить поле из Hash
- `hexists(key: string, field: string): Promise<number>` - проверить существование поля в Hash
- `hscan(key: string, cursor: number, pattern?: string, count?: number): Promise<[string, string[]]>` - сканировать Hash

#### Sorted Set методы

- `zadd(key: string, score: number, member: string): Promise<number>` - добавить элемент в Sorted Set
- `zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>` - получить элементы по диапазону
- `zrem(key: string, member: string): Promise<number>` - удалить элемент из Sorted Set
- `zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>` - удалить элементы по score диапазону
- `zscore(key: string, member: string): Promise<string | null>` - получить score элемента

#### Set методы

- `sadd(key: string, member: string): Promise<number>` - добавить элемент в Set
- `smembers(key: string): Promise<string[]>` - получить все элементы Set
- `srem(key: string, member: string): Promise<number>` - удалить элемент из Set
- `sismember(key: string, member: string): Promise<number>` - проверить существование элемента в Set

#### Redis Streams методы

- `xadd(key: string, id: string, fields: Record<string, string>): Promise<string>` - добавить запись в Stream
- `xread(streams: Array<{ key: string; id: string }>, count?: number): Promise<Array<{ key: string; messages: Array<{ id: string; fields: Record<string, string> }> }>> | null>` - прочитать записи из Stream
- `xtrim(key: string, maxlen: number): Promise<number>` - обрезать Stream до maxlen

#### Очистка методы

- `scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]>` - сканировать ключи по паттерну
- `cleanupOldKeys(pattern: string, maxAgeSeconds: number): Promise<number>` - очистить старые ключи по паттерну

### `RedisClientError`

Кастомная ошибка Redis клиента с автоматическим логированием.

```typescript
import { RedisClientError } from '@packages/redis-client';

try {
  await redisClient.get('key');
} catch (error) {
  if (error instanceof RedisClientError) {
    // Ошибка уже залогирована автоматически
    const originalError = error.getOriginalError();
  }
}
```

**Особенности:**
- Автоматически логирует ошибку при создании
- Сохраняет stack trace оригинальной ошибки
- Предоставляет доступ к оригинальной ошибке через `getOriginalError()`

## 🔧 Настройка переменных окружения

Добавьте в `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # опционально
REDIS_DB=0
```

## 🎯 Типы и интерфейсы

### RedisClientModuleOptions

Опции конфигурации для Redis модуля.

```typescript
interface RedisClientModuleOptions {
  /** Хост Redis сервера */
  host: string;
  /** Порт Redis сервера */
  port: number;
  /** Пароль для аутентификации (опционально) */
  password?: string;
  /** Номер базы данных Redis (0-15, по умолчанию 0) */
  db?: number;
  /** Дополнительные опции ioredis */
  options?: Partial<RedisOptions>;
}
```

### RedisClientContract

Интерфейс Redis клиента (используется внутри пакета, не экспортируется). См. раздел API Reference для полного списка методов `RedisClientService`.

## 🔌 Интеграция с Socket.IO

Redis используется для синхронизации Socket.IO серверов через Redis Adapter.

### Установка адаптера

```bash
npm install @socket.io/redis-adapter
```

### Использование в main.ts

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisSocketIoAdapter } from '@packages/redis-client';
import { RedisClientService } from '@packages/redis-client';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@makebelieve21213-packages/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  
  const redisClient = app.get(RedisClientService);
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  
  app.useWebSocketAdapter(
    new RedisSocketIoAdapter(app, configService, logger, redisClient)
  );
  
  await app.listen(3000);
}

bootstrap();
```

## 📖 Примеры использования

### Кэширование данных пользователя

```typescript
@Injectable()
export class UserCacheService {
  constructor(private readonly redis: RedisClientService) {}

  async cacheUser(userId: string, userData: User): Promise<void> {
    const key = this.redis.makeUserKey(userId, 'profile');
    await this.redis.set(key, JSON.stringify(userData), 3600);
  }

  async getUser(userId: string): Promise<User | null> {
    const key = this.redis.makeUserKey(userId, 'profile');
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateUser(userId: string): Promise<void> {
    const key = this.redis.makeUserKey(userId, 'profile');
    await this.redis.del(key);
  }
}
```

### Хранение сессий

```typescript
@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisClientService) {}

  async createSession(userId: string, token: string): Promise<void> {
    const key = this.redis.makeUserKey(userId, 'session');
    await this.redis.set(key, token, 86400); // 24 часа
  }

  async validateSession(userId: string, token: string): Promise<boolean> {
    const key = this.redis.makeUserKey(userId, 'session');
    const storedToken = await this.redis.get(key);
    return storedToken === token;
  }

  async getSessionTTL(userId: string): Promise<number> {
    const key = this.redis.makeUserKey(userId, 'session');
    return await this.redis.ttl(key);
  }
}
```

### Rate limiting

```typescript
@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisClientService) {}

  async checkRateLimit(userId: string, limit: number): Promise<boolean> {
    const key = this.redis.makeUserKey(userId, 'rate-limit');
    const current = await this.redis.get(key);

    if (!current) {
      await this.redis.set(key, '1', 60); // 1 минута
      return true;
    }

    const count = parseInt(current, 10);
    if (count >= limit) {
      return false;
    }

    await this.redis.set(key, (count + 1).toString(), 60);
    return true;
  }
}
```

## 🧪 Тестирование

Пакет имеет **100% покрытие тестами**.

```bash
# Запустить тесты
npm test

# Запустить тесты с покрытием
npm run test:coverage

# Watch режим
npm run test:watch
```

## 🚨 Troubleshooting

### Redis не подключается

**Проблема:** Не удается подключиться к Redis

**Решение:**
1. Проверьте переменные окружения (`REDIS_HOST`, `REDIS_PORT`)
2. Убедитесь, что Redis запущен: `docker-compose ps`
3. Проверьте логи: `docker-compose logs redis`
4. Проверьте сетевые настройки (firewall, Docker network)

### Ошибка "Redis клиент не инициализирован"

**Проблема:** `Redis клиент не инициализирован`

**Решение:**
1. Убедитесь, что `RedisClientModule` импортирован в `AppModule`
2. Проверьте, что `onModuleInit()` был вызван (происходит автоматически)
3. Проверьте порядок импорта модулей

### Проблемы с Socket.IO масштабированием

**Проблема:** Socket.IO события не синхронизируются между инстансами

**Решение:**
1. Проверьте, что Redis adapter подключен через `RedisSocketIoAdapter`
2. Убедитесь, что используются отдельные клиенты для pub/sub (создаются автоматически)
3. Проверьте конфигурацию Redis в docker-compose.yml
4. Убедитесь, что все инстансы используют один и тот же Redis сервер

### Проблемы с производительностью

**Проблема:** Медленные операции Redis

**Решение:**
1. Используйте connection pooling (реализовано автоматически через Singleton)
2. Проверьте сетевую задержку между приложением и Redis
3. Используйте pipeline для множественных операций через `getClient()`
4. Оптимизируйте использование памяти Redis (настройте maxmemory)

## 🔑 Особенности реализации

### Singleton Pattern

Redis клиент использует паттерн Singleton для создания единого экземпляра подключения:

```typescript
private static instance: Redis | null = null;

async onModuleInit(): Promise<void> {
  if (!RedisClientService.instance) {
    RedisClientService.instance = new Redis({ ... });
  }
}
```

**Преимущества:**
- Экономия ресурсов (одно подключение вместо множества)
- Автоматический connection pooling через ioredis
- Безопасное переиспользование в разных модулях

### Graceful Shutdown

Модуль автоматически закрывает подключение при остановке приложения:

```typescript
async onModuleDestroy(): Promise<void> {
  await this.disconnect();
}
```

### Логирование

Все операции логируются через `@makebelieve21213-packages/logger`:
- Подключение/отключение
- Ошибки операций через `RedisClientError` (автоматическое логирование)
- События Redis (connect, error, close)

### Обработка ошибок

Кастомная ошибка `RedisClientError`:
- Автоматически логирует ошибку при создании
- Сохраняет stack trace оригинальной ошибки
- Предоставляет доступ к оригинальной ошибке через `getOriginalError()`

## 📄 Лицензия

UNLICENSED (private package)

## 👥 Автор

Skryabin Aleksey
