import { createServer } from 'http';
import { app } from './app';
import { config } from '../config';
import { logger } from '../utils/logger';
import { webSocketManager } from './websocket';

const httpServer = createServer(app);

// Initialize Socket.io WebSocket server
webSocketManager.initialize(httpServer, config.corsOrigin);

httpServer.listen(config.port, async () => {
  logger.info(`==================================================`);
  logger.info(` Emergency AI Core Backend Engine Started`);
  logger.info(` Environment: ${config.nodeEnv}`);
  logger.info(` Server Listening on Port: ${config.port}`);
  logger.info(` WebSockets Enabled on Port: ${config.port}`);
  logger.info(` Health Endpoint: http://localhost:${config.port}/health`);
  logger.info(` API Prefix: http://localhost:${config.port}${config.apiPrefix}`);
  logger.info(`==================================================`);

  // Perform initial database connection check on boot
  try {
    const { dbService } = await import('../config/database');
    const health = await dbService.checkDatabaseHealth();
    logger.info(`[DATABASE_STARTUP] Connection: ${health.status} (${health.message})`);
  } catch (err: any) {
    logger.warn(`[DATABASE_STARTUP_WARN] Initial DB check: ${err.message}`);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down HTTP & WebSocket server gracefully...`);
  httpServer.close(() => {
    logger.info('HTTP and WebSocket servers closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { httpServer };
