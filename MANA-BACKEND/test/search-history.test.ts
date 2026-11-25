import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AppConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import type { AppLogger } from '../src/logger.js';
import type { SearchHistoryRepository, SearchHistoryRecord } from '../src/search-history/repository.js';

const config: AppConfig = {
  nodeEnv: 'development',
  host: '127.0.0.1',
  port: 0,
  corsOrigins: ['http://localhost:8080'],
  databaseUrl: 'postgres://test:test@localhost/test',
  databaseSsl: 'disable',
  mongodbUrl: 'mongodb://127.0.0.1:27017',
  mongodbDatabase: 'mana_ai_test',
  adminSubjects: [],
  aiProvider: 'openai-compatible',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'test-model',
  aiAllowedModels: ['test-model'],
  aiTimeoutMs: 1000,
  chatRateLimitPerMinute: 10,
  chatMaxInputMessages: 10,
  chatMaxMessageCharacters: 500,
  chatMaxResponseBytes: 1024,
  logLevel: 'silent',
};

const logger = {
  info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, silent() {},
  level: 'silent',
  isLevelEnabled: () => false,
} as unknown as AppLogger;

let server: Server;
let baseUrl: string;
const records = new Map<string, SearchHistoryRecord>();

const repository = {
  async save(input: { userId: string; query: string; searchType: string; source: string; status: string }) {
    const record: SearchHistoryRecord = {
      id: `record-${records.size + 1}`,
      query: input.query,
      searchType: input.searchType,
      source: input.source,
      conversationId: null,
      status: input.status,
      createdAt: new Date('2026-11-24T10:00:00.000Z'),
      updatedAt: new Date('2026-11-24T10:00:00.000Z'),
      metadata: {},
    };
    records.set(`${input.userId}:${record.id}`, record);
    return record;
  },
  async list(userId: string, page: number, limit: number) {
    const data = [...records.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, record]) => record)
      .slice((page - 1) * limit, page * limit);
    return { data, total: data.length };
  },
  async search(userId: string, query: string, page: number, limit: number) {
    const data = [...records.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, record]) => record)
      .filter((record) => record.query.toLowerCase().includes(query.toLowerCase()))
      .slice((page - 1) * limit, page * limit);
    return { data, total: data.length };
  },
  async get(userId: string, id: string) {
    return records.get(`${userId}:${id}`) ?? null;
  },
  async deleteOne(userId: string, id: string) {
    return records.delete(`${userId}:${id}`);
  },
  async deleteAll(userId: string) {
    let deleted = 0;
    for (const key of records.keys()) {
      if (key.startsWith(`${userId}:`) && records.delete(key)) deleted++;
    }
    return deleted;
  },
} as unknown as SearchHistoryRepository;

before(async () => {
  const app = createApp({
    config,
    logger,
    pool: { query: async () => ({ rows: [], rowCount: 1 }) } as never,
    tokenVerifier: async (token) => {
      if (token === 'valid-user-a') return { subject: 'user-a' };
      if (token === 'valid-user-b') return { subject: 'user-b' };
      throw new Error('invalid token');
    },
    searchHistoryRepository: repository,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('search history requires authentication', async () => {
  const response = await fetch(`${baseUrl}/v1/search-history`);
  assert.equal(response.status, 401);
});

test('search history saves, lists, searches, and isolates users', async () => {
  const saved = await fetch(`${baseUrl}/v1/search-history`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer valid-user-a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: 'Artificial Intelligence',
      searchType: 'ai_chat',
      source: 'chat_composer',
      status: 'submitted',
    }),
  });
  assert.equal(saved.status, 201);

  const list = await fetch(`${baseUrl}/v1/search-history?page=1&limit=30`, {
    headers: { authorization: 'Bearer valid-user-a' },
  });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data.length, 1);

  const otherUser = await fetch(`${baseUrl}/v1/search-history`, {
    headers: { authorization: 'Bearer valid-user-b' },
  });
  assert.equal((await otherUser.json()).data.length, 0);

  const search = await fetch(`${baseUrl}/v1/search-history?q=artificial`, {
    headers: { authorization: 'Bearer valid-user-a' },
  });
  assert.equal((await search.json()).data.length, 1);
});

test('search history supports individual and clear-all deletion', async () => {
  const beforeDelete = await fetch(`${baseUrl}/v1/search-history`, {
    headers: { authorization: 'Bearer valid-user-a' },
  });
  const item = (await beforeDelete.json()).data[0] as SearchHistoryRecord;

  const deleted = await fetch(`${baseUrl}/v1/search-history/${item.id}`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer valid-user-a' },
  });
  assert.equal(deleted.status, 204);

  await fetch(`${baseUrl}/v1/search-history`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer valid-user-a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: 'Second search',
      searchType: 'global_search',
      source: 'composer',
    }),
  });

  const cleared = await fetch(`${baseUrl}/v1/search-history`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer valid-user-a' },
  });
  assert.equal(cleared.status, 200);
});
