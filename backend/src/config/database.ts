import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

class DatabaseService {
  private static instance: DatabaseService;
  public prisma: PrismaClient;
  private isConnected = false;
  private lastHealthCheckTime = 0;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public isDbConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Performs a real health check query against PostgreSQL + PostGIS.
   */
  public async checkDatabaseHealth(): Promise<{
    status: 'HEALTHY' | 'UNHEALTHY' | 'DISCONNECTED';
    latencyMs?: number;
    postgisVersion?: string;
    message?: string;
  }> {
    const start = Date.now();
    try {
      // Execute lightweight raw query against PostgreSQL
      const result = await this.prisma.$queryRaw<Array<{ postgis_ver?: string }>>`
        SELECT PostGIS_Lib_Version() AS postgis_ver;
      `;

      const latencyMs = Date.now() - start;
      this.isConnected = true;
      this.lastHealthCheckTime = Date.now();
      const postgisVersion = result[0]?.postgis_ver || 'PostGIS Enabled';

      return {
        status: 'HEALTHY',
        latencyMs,
        postgisVersion,
        message: 'PostgreSQL + PostGIS database connection active',
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      this.isConnected = false;
      this.lastHealthCheckTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        status: 'UNHEALTHY',
        latencyMs,
        message: `PostgreSQL connection unavailable at ${process.env.DATABASE_URL || 'DATABASE_URL'}: ${errorMessage}`,
      };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database client disconnected cleanly.');
    }
  }
}

export const dbService = DatabaseService.getInstance();
export const prisma = dbService.prisma;
