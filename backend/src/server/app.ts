import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { requestLogger } from '../middleware/requestLogger';
import { notFoundHandler } from '../middleware/notFoundHandler';
import { errorHandler } from '../middleware/errorHandler';
import apiRoutes from '../routes';
import healthRoutes from '../routes/healthRoutes';

export const createApp = (): Application => {
  const app: Application = express();

  // Trust proxy for rate limiting (assumes behind load balancer/proxy in prod)
  app.set('trust proxy', 1);

  // Basic security middleware
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Top-level health check endpoint
  app.use('/health', healthRoutes);

  // API router group
  app.use(config.apiPrefix, apiRoutes);

  // 404 Handler for undefined routes
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
