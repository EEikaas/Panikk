// Kjør: npm run simulate [-- --url http://localhost:3001] [--speed 0.1] [--length kort|normal|lang]
// Uten --url startes en egen server i prosessen (med ALLOW_TIME_SCALE).
import { startServer } from '../app';
import { loadConfig } from '../config';
import { MemoryStore } from '../store';
import { runSimulation } from './harness';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// PowerShell sluker «--» foran flagg, så posisjonelle argumenter støttes også: simulate 0.05 lang
const positional = args.filter((a) => !a.startsWith('--'));
const speed = Number(arg('speed') ?? positional.find((a) => !isNaN(Number(a))) ?? 0.1);
const length = (arg('length') ?? positional.find((a) => ['kort', 'normal', 'lang'].includes(a)) ?? 'kort') as 'kort' | 'normal' | 'lang';
let url = arg('url');
let close: (() => Promise<void>) | null = null;

if (!url) {
  const server = await startServer({ ...loadConfig(), port: 0, host: '127.0.0.1', allowTimeScale: true, dataFile: undefined, databaseUrl: undefined }, { store: new MemoryStore() });
  url = server.url;
  close = () => server.close();
  console.log(`Startet testserver på ${url}`);
}

console.log(`Simulerer 12 spillere · lengde ${length} · tidsfaktor ${speed}`);
const t = (msg: string) => console.log(`  [${new Date().toISOString().slice(11, 19)}] ${msg}`);
try {
  const report = await runSimulation({ url, timeScale: speed, length, log: t });
  console.log('\n=== RESULTAT ===');
  console.log(`Rom: ${report.code} · varighet ${(report.durationMs / 1000).toFixed(1)} s`);
  console.log(`Vinner: ${report.winnerName}`);
  for (const p of [...report.players].sort((a, b) => b.score - a.score)) console.log(`  ${p.name.padEnd(16)} ${p.label.padEnd(14)} ${String(p.score).padStart(6)}`);
  console.log(`Gjenoppkobling: ${report.reconnectOk ? 'OK' : 'FEIL'} · Visningsbytte: ${report.viewSwitchOk ? 'OK' : 'FEIL'}`);
  if (report.consistencyErrors.length) {
    console.log('Konsistensfeil:');
    for (const e of report.consistencyErrors) console.log('  - ' + e);
    process.exitCode = 1;
  } else console.log('Ingen konsistensfeil – alle 13 klienter så samme spillstatus. ✅');
} catch (e) {
  console.error('Simuleringen feilet:', e);
  process.exitCode = 1;
} finally {
  await close?.();
}
