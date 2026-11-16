import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { AuthService } from './auth';
import type { Config } from './config';
import { createHttpApp } from './http';
import { ExternalQuestionSource } from './questions/external';
import { RoomManager } from './rooms';
import { registerSocketHandlers } from './socket';
import { createStore, type Store } from './store';

export interface RunningServer {
  port: number;
  url: string;
  rooms: RoomManager;
  store: Store;
  close(): Promise<void>;
}

export async function startServer(config: Config, opts: { store?: Store; external?: ExternalQuestionSource } = {}): Promise<RunningServer> {
  const store = opts.store ?? (await createStore({ databaseUrl: config.databaseUrl, dataFile: config.dataFile }));
  const auth = new AuthService(store, config);
  await auth.ensureAdmin();

  const httpServer = createServer();
  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: { maxDisconnectionDuration: 0 },
    cors: config.allowedOrigins.length ? { origin: config.allowedOrigins, credentials: true } : undefined,
  });

  const rooms = new RoomManager(store, opts.external ?? new ExternalQuestionSource(), (sid, state) => io.to(sid).emit('state', state), {
    allowBots: config.allowBots,
    allowTimeScale: config.allowTimeScale,
  });
  const app = createHttpApp({ config, store, auth, rooms });
  httpServer.on('request', app);
  registerSocketHandlers(io, rooms, auth, config);

  await new Promise<void>((res) => httpServer.listen(config.port, config.host, res));
  const port = (httpServer.address() as AddressInfo).port;
  return {
    port,
    url: `http://localhost:${port}`,
    rooms,
    store,
    async close() {
      rooms.stop();
      io.close();
      await new Promise<void>((res) => httpServer.close(() => res()));
    },
  };
}
