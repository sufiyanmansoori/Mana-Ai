import { type Document } from 'mongodb';
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
export declare class SearchHistoryRepository {
    private readonly url;
    private readonly databaseName;
    private client;
    private collection;
    constructor(url: string, databaseName: string);
    initialize(): Promise<void>;
    save(input: {
        userId: string;
        query: string;
        searchType: string;
        source: string;
        conversationId?: string;
        status: string;
        idempotencyKey?: string;
        metadata?: Document;
    }): Promise<SearchHistoryRecord>;
    list(userId: string, page: number, limit: number): Promise<{
        data: SearchHistoryRecord[];
        total: number;
    }>;
    search(userId: string, query: string, page: number, limit: number): Promise<{
        data: SearchHistoryRecord[];
        total: number;
    }>;
    get(userId: string, id: string): Promise<SearchHistoryRecord | null>;
    deleteOne(userId: string, id: string): Promise<boolean>;
    deleteAll(userId: string): Promise<number>;
    close(): Promise<void>;
    private map;
}
