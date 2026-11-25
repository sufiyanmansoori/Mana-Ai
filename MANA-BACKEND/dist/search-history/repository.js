import { MongoClient, ObjectId, } from 'mongodb';
export class SearchHistoryRepository {
    url;
    databaseName;
    client;
    collection;
    constructor(url, databaseName) {
        this.url = url;
        this.databaseName = databaseName;
    }
    async initialize() {
        if (this.collection)
            return;
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
        }).catch(async (error) => {
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
        this.collection = database.collection('user_search_history');
        await Promise.all([
            this.collection.createIndex({ userId: 1, createdAt: -1 }),
            this.collection.createIndex({ userId: 1, query: 'text' }),
            this.collection.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true }),
        ]);
    }
    async save(input) {
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
        let record;
        if (update) {
            record = await this.collection.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', includeResultMetadata: false });
        }
        else {
            record = await this.collection.findOneAndUpdate(filter, { $setOnInsert: {
                    userId: input.userId,
                    query: input.query,
                    searchType: input.searchType,
                    source: input.source,
                    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
                    status: input.status,
                    metadata: input.metadata ?? {},
                    createdAt: now,
                    updatedAt: now,
                } }, { upsert: true, returnDocument: 'after', includeResultMetadata: false });
        }
        if (!record)
            throw new Error('Search history record could not be saved.');
        return this.map(record);
    }
    async list(userId, page, limit) {
        await this.initialize();
        const filter = { userId };
        const [records, total] = await Promise.all([
            this.collection.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.collection.countDocuments(filter),
        ]);
        return { data: records.map((record) => this.map(record)), total };
    }
    async search(userId, query, page, limit) {
        await this.initialize();
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const filter = {
            userId,
            query: { $regex: escaped, $options: 'i' },
        };
        const [records, total] = await Promise.all([
            this.collection.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.collection.countDocuments(filter),
        ]);
        return { data: records.map((record) => this.map(record)), total };
    }
    async get(userId, id) {
        await this.initialize();
        if (!ObjectId.isValid(id))
            return null;
        const record = await this.collection.findOne({
            _id: new ObjectId(id),
            userId,
        });
        return record ? this.map(record) : null;
    }
    async deleteOne(userId, id) {
        await this.initialize();
        if (!ObjectId.isValid(id))
            return false;
        const result = await this.collection.deleteOne({
            _id: new ObjectId(id),
            userId,
        });
        return result.deletedCount === 1;
    }
    async deleteAll(userId) {
        await this.initialize();
        const result = await this.collection.deleteMany({ userId });
        return result.deletedCount;
    }
    async close() {
        await this.client?.close();
    }
    map(record) {
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
//# sourceMappingURL=repository.js.map