import { createApp } from './app';
import { config } from './config';
import { prisma } from './config/prisma';

async function bootstrap() {
  try {
    // Verify DB connection
    await prisma.$connect();
    const sanitizedDbUrl = config.databaseUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`[Database] PostgreSQL successfully connected on ${sanitizedDbUrl}`);

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`[Backend] Accommodation API listening on http://localhost:${config.port}`);
      console.log(`[Backend] Health check available at http://localhost:${config.port}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('[Backend] Resources closed. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Fatal initialization error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
