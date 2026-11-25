import {
  MongoClient,
  ObjectId,
  type Collection,
  type Document,
  type WithId,
} from 'mongodb';

export interface SearchHistoryRecord {
  id: string;
  query: string;
  searchType: string;
  source: string;
  conversationId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Document;
}

interface StoredSearchHistoryRecord extends Document {
  _id: ObjectId;
  userId: string;
  query: string;
  searchType: string;
  source: string;
  conversationId?: string;
  status: string;
  idempotencyKey?: string;
  metadata: Document;
  createdAt: Date;
  updatedAt: Date;
}

export class SearchHistoryRepository {
  private client: MongoClient | undefined;
  private collection: Collection<StoredSearchHistoryRecord> | undefined;

  constructor(
    private readonly url: string,
    private readonly databaseName: string,
  ) {}

  async initialize(): Promise<void> {
    if (this.collection) return;
    this.client = new MongoClient(this.url, {
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 20,
    });
    await this.client.connect();
    const database = this.client.db(this.databaseName);
    await database.command({
      collMod: 'user_search_history',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'userId',
            'query',
            'searchType',
            'source',
            'status',
            'createdAt',
            'updatedAt',
          ],
          properties: {
            userId: { bsonType: 'string', minLength: 1, maxLength: 256 },
            query: { bsonType: 'string', minLength: 1, maxLength: 1000 },
            searchType: { bsonType: 'string', maxLength: 64 },
            source: { bsonType: 'string', maxLength: 64 },
            status: { bsonType: 'string', maxLength: 32 },
            metadata: { bsonType: 'object' },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    }).catch(async (error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('NamespaceNotFound')) {
        throw error;
      }
      await database.createCollection('user_search_history', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'userId',
              'query',
              'searchType',
              'source',
              'status',
              'createdAt',
              'updatedAt',
            ],
          },
        },
        validationLevel: 'strict',
        validationAction: 'error',
      });
    });
    this.collection = database.collection<StoredSearchHistoryRecord>(
      'user_search_history',
    );
    await Promise.all([
      this.collection.createIndex({ userId: 1, createdAt: -1 }),
      this.collection.createIndex({ userId: 1, query: 'text' }),
      this.collection.createIndex(
        { userId: 1, idempotencyKey: 1 },
        { unique: true, sparse: true },
      ),
    ]);
  }

  async save(input: {
    userId: string;
    query: string;
    searchType: string;
    source: string;
    conversationId?: string;
    status: string;
    idempotencyKey?: string;
    metadata?: Document;
  }): Promise<SearchHistoryRecord> {
    await this.initialize();
    const now = new Date();
    const filter = input.idempotencyKey
      ? { userId: input.userId, idempotencyKey: input.idempotencyKey }
      : { _id: new ObjectId() };
    const update = input.idempotencyKey
      ? {
          $setOnInsert: {
            userId: input.userId,
            query: input.query,
            searchType: input.searchType,
            source: input.source,
            ...(input.conversationId
              ? { conversationId: input.conversationId }
              : {}),
            status: input.status,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
          },
        }
      : null;
    let record: WithId<StoredSearchHistoryRecord> | null;
    if (update) {
      record = await this.collection!.findOneAndUpdate(
        filter,
        update,
        { upsert: true, returnDocument: 'after', includeResultMetadata: false },
      );
    } else {
      record = await this.collection!.findOneAndUpdate(
        filter,
        { $setOnInsert: {
          userId: input.userId,
          query: input.query,
          searchType: input.searchType,
          source: input.source,
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
          status: input.status,
          metadata: input.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        } },
        { upsert: true, returnDocument: 'after', includeResultMetadata: false },
      );
    }
    if (!record) throw new Error('Search history record could not be saved.');
    return this.map(record);
  }

  async list(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: SearchHistoryRecord[]; total: number }> {
    await this.initialize();
    const filter = { userId };
    const [records, total] = await Promise.all([
      this.collection!.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection!.countDocuments(filter),
    ]);
    return { data: records.map((record) => this.map(record)), total };
  }

  async search(
    userId: string,
    query: string,
    page: number,
    limit: number,
  ): Promise<{ data: SearchHistoryRecord[]; total: number }> {
    await this.initialize();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      userId,
      query: { $regex: escaped, $options: 'i' },
    };
    const [records, total] = await Promise.all([
      this.collection!.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection!.countDocuments(filter),
    ]);
    return { data: records.map((record) => this.map(record)), total };
  }

  async get(userId: string, id: string): Promise<SearchHistoryRecord | null> {
    await this.initialize();
    if (!ObjectId.isValid(id)) return null;
    const record = await this.collection!.findOne({
      _id: new ObjectId(id),
      userId,
    });
    return record ? this.map(record) : null;
  }

  async deleteOne(userId: string, id: string): Promise<boolean> {
    await this.initialize();
    if (!ObjectId.isValid(id)) return false;
    const result = await this.collection!.deleteOne({
      _id: new ObjectId(id),
      userId,
    });
    return result.deletedCount === 1;
  }

  async deleteAll(userId: string): Promise<number> {
    await this.initialize();
    const result = await this.collection!.deleteMany({ userId });
    return result.deletedCount;
  }

  async close(): Promise<void> {
    await this.client?.close();
  }

  private map(record: WithId<StoredSearchHistoryRecord>): SearchHistoryRecord {
    return {
      id: record._id.toHexString(),
      query: record.query,
      searchType: record.searchType,
      source: record.source,
      conversationId: record.conversationId ?? null,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      metadata: record.metadata ?? {},
    };
  }
}
