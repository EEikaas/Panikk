import { MemoryStore } from './memory';
import { PrismaStore } from './prisma';
import type { Store } from './types';

export * from './types';
export { MemoryStore, PrismaStore };

export async function createStore(opts: { databaseUrl?: string; dataFile?: string }): Promise<Store> {
  const store: Store = opts.databaseUrl ? new PrismaStore() : new MemoryStore(opts.dataFile);
  await store.init();
  return store;
}
