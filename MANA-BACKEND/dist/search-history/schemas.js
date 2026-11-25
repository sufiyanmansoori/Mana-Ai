import { z } from 'zod';
export const SearchTypeSchema = z.enum([
    'ai_chat',
    'web_search',
    'deep_research',
    'conversation_search',
    'image_search',
    'document_search',
    'global_search',
]);
export const SaveSearchHistorySchema = z.object({
    query: z.string().trim().min(1).max(1000),
    searchType: SearchTypeSchema,
    source: z.string().trim().min(1).max(64),
    conversationId: z.string().trim().min(1).max(128).optional(),
    status: z.enum(['submitted', 'completed', 'failed']).default('submitted'),
    idempotencyKey: z.string().trim().min(16).max(128).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const ListSearchHistorySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    q: z.string().trim().min(1).max(1000).optional(),
});
//# sourceMappingURL=schemas.js.map