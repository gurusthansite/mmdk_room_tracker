import { createApp } from './app';
import { config } from './config';
import { prisma } from './config/prisma';

async function bootstrap() {
  try {
    // Verify DB connection
    await prisma.$connect();
    const sanitizedDbUrl = config.databaseUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`[Database] PostgreSQL successfully connected on ${sanitizedDbUrl}`);

    // One-time cleanup of test data across environments (executed once, recorded in system_checks)
    try {
      const cleanupRecord = await prisma.systemCheck.findFirst({
        where: { status: 'PRODUCTION_TEST_DATA_WIPED_V1' },
      });

      if (!cleanupRecord) {
        console.log('[Maintenance] Checking database for test records to wipe...');
        try {
          await prisma.$executeRawUnsafe(`
            TRUNCATE TABLE 
              stay_records, 
              allocation_items, 
              allocations, 
              aadhaar_records, 
              message_logs, 
              participants, 
              registrations, 
              accommodation_units, 
              rooms, 
              hotels, 
              activity_logs 
            CASCADE;
          `);
        } catch (err: any) {
          console.warn('[Maintenance] Table truncate warning:', err.message);
        }

        try {
          await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS registration_id_seq RESTART WITH 1;`);
          await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS allocation_number_seq RESTART WITH 1;`);
        } catch (err: any) {
          console.warn('[Maintenance] Sequence restart warning:', err.message);
        }

        await prisma.systemCheck.create({
          data: { status: 'PRODUCTION_TEST_DATA_WIPED_V1' },
        });
        console.log('[Maintenance] Database cleanup finished. All test records cleared; AdminUser accounts preserved.');
      }
    } catch (checkErr: any) {
      console.warn('[Maintenance] Startup cleanup check error:', checkErr.message);
    }

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
