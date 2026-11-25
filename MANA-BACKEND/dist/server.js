import 'dotenv/config';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createLogger } from './logger.js';
let runtimePromise;
async function createRuntime() {
    const config = loadConfig();
    const logger = createLogger(config.logLevel, config.loggerConfig);
    const pool = createPool(config);
    try {
        await pool.query('SELECT NOW()');
        logger.info('Database connection established successfully');
        const app = createApp({ config, pool, logger });
        return { app, config, logger, pool };
    }
    catch (error) {
        logger.fatal({ err: error }, 'Failed to initialize Mana AI API');
        try {
            await pool.end();
        }
        catch (closeError) {
            logger.error({ err: closeError }, 'Failed to close database pool after startup error');
        }
        throw error;
    }
}
function getRuntime() {
    if (!runtimePromise) {
        runtimePromise = createRuntime().catch((error) => {
            runtimePromise = undefined;
            throw error;
        });
    }
    return runtimePromise;
}
export default async function handler(req, res) {
    const { app } = await getRuntime();
    app(req, res);
}
async function startServer() {
    const { app, config, logger, pool } = await getRuntime();
    const server = createServer(app);
    const rateLimitCleanup = setInterval(async () => {
        try {
            await pool.query("DELETE FROM rate_limit_windows WHERE window_start < now() - interval '1 day'");
        }
        catch (error) {
            logger.error({ err: error }, 'Rate-limit cleanup failed');
        }
    }, 60 * 60 * 1000);
    rateLimitCleanup.unref();
    server.listen(config.port, config.host, () => {
        logger.info({
            host: config.host,
            port: config.port,
            env: config.nodeEnv,
            pid: process.pid
        }, 'Mana AI API is listening');
    });
    let isShuttingDown = false;
    const shutdown = async (signal) => {
        if (isShuttingDown)
            return;
        isShuttingDown = true;
        logger.warn({ signal }, 'Graceful shutdown initiated');
        clearInterval(rateLimitCleanup);
        const forceKillTimer = setTimeout(() => {
            logger.error('Graceful shutdown timed out. Forcing exit...');
            process.exit(1);
        }, config.appConfig?.shutdownTimeoutMs ?? 15000);
        forceKillTimer.unref();
        try {
            await new Promise((resolveClose) => {
                server.close(() => resolveClose());
            });
            logger.info('HTTP server closed');
            await pool.end();
            logger.info('Database pool drained');
            clearTimeout(forceKillTimer);
            process.exit(0);
        }
        catch (error) {
            logger.error({ err: error }, 'Error during shutdown');
            clearTimeout(forceKillTimer);
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    pool.on('error', (error) => {
        logger.fatal({ err: error }, 'Unexpected idle database client error');
        process.exit(1);
    });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    void startServer().catch((error) => {
        console.error('Failed to start Mana AI API', error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=server.js.map