import { Router } from 'express';
import type { TokenVerifier } from '../auth/tokens.js';
import { SearchHistoryRepository } from './repository.js';
export declare function createSearchHistoryRouter(input: {
    verifier: TokenVerifier;
    repository: SearchHistoryRepository;
}): Router;
