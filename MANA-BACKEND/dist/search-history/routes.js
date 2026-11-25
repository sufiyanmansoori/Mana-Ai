import { Router } from 'express';
import { requireAuthentication } from '../auth/middleware.js';
import { ApiError } from '../errors.js';
import { ListSearchHistorySchema, SaveSearchHistorySchema, } from './schemas.js';
export function createSearchHistoryRouter(input) {
    const router = Router();
    const authenticate = requireAuthentication(input.verifier);
    router.post('/search-history', authenticate, async (request, response, next) => {
        try {
            const body = SaveSearchHistorySchema.parse(request.body);
            const record = await input.repository.save({
                userId: request.auth.subject,
                query: body.query,
                searchType: body.searchType,
                source: body.source,
                status: body.status,
                ...(body.conversationId !== undefined
                    ? { conversationId: body.conversationId }
                    : {}),
                ...(body.idempotencyKey !== undefined
                    ? { idempotencyKey: body.idempotencyKey }
                    : {}),
                ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
            });
            response.status(201).json({ data: record });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/search-history', authenticate, async (request, response, next) => {
        try {
            const { page, limit, q } = ListSearchHistorySchema.parse(request.query);
            const result = q
                ? await input.repository.search(request.auth.subject, q, page, limit)
                : await input.repository.list(request.auth.subject, page, limit);
            response.json({
                data: result.data,
                page,
                limit,
                total: result.total,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/search-history/:id', authenticate, async (request, response, next) => {
        try {
            if (typeof request.params.id !== 'string') {
                throw new ApiError(400, 'invalid_search_history_id', 'Invalid search history ID.');
            }
            const record = await input.repository.get(request.auth.subject, request.params.id);
            if (!record) {
                throw new ApiError(404, 'search_history_not_found', 'Search history was not found.');
            }
            response.json({ data: record });
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/search-history', authenticate, async (request, response, next) => {
        try {
            const deleted = await input.repository.deleteAll(request.auth.subject);
            response.json({ data: { deleted } });
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/search-history/:id', authenticate, async (request, response, next) => {
        try {
            if (typeof request.params.id !== 'string') {
                throw new ApiError(400, 'invalid_search_history_id', 'Invalid search history ID.');
            }
            const deleted = await input.repository.deleteOne(request.auth.subject, request.params.id);
            if (!deleted) {
                throw new ApiError(404, 'search_history_not_found', 'Search history was not found.');
            }
            response.status(204).end();
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
//# sourceMappingURL=routes.js.map