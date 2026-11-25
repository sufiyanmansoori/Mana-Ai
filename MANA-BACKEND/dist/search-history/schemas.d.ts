import { z } from 'zod';
export declare const SearchTypeSchema: z.ZodEnum<{
    ai_chat: "ai_chat";
    web_search: "web_search";
    deep_research: "deep_research";
    conversation_search: "conversation_search";
    image_search: "image_search";
    document_search: "document_search";
    global_search: "global_search";
}>;
export declare const SaveSearchHistorySchema: z.ZodObject<{
    query: z.ZodString;
    searchType: z.ZodEnum<{
        ai_chat: "ai_chat";
        web_search: "web_search";
        deep_research: "deep_research";
        conversation_search: "conversation_search";
        image_search: "image_search";
        document_search: "document_search";
        global_search: "global_search";
    }>;
    source: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        submitted: "submitted";
        completed: "completed";
        failed: "failed";
    }>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export declare const ListSearchHistorySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
