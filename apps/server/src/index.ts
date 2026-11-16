import { startServer } from './app';
import { loadConfig } from './config';

const config = loadConfig();

if (config.isProd && !config.databaseUrl && !config.dataFile) {
  console.warn('[podiepanikk] Verken DATABASE_URL eller DATA_FILE er satt – profiler og resultater lagres bare i minnet!');
}

const server = await startServer(config);
console.log(`🎤 PODIEPANIKK! kjører på port ${server.port} (lagring: ${server.store.kind}${config.webDist ? ', serverer frontend' : ''})`);

const shutdown = async (signal: string) => {
  console.log(`[podiepanikk] ${signal} mottatt – avslutter …`);
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
