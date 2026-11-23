// Palmar Bay — build entrypoint (Node stdlib only).
// Copies game/ + screenshots/ into the output dir and writes dossier.json.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'out');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');
if (existsSync(gameSrc)) cpSync(gameSrc, join(out, 'game'), { recursive: true });
if (existsSync(shotsSrc)) cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
// buildDossier returns the dossier file bytes — write them raw, not JSON.stringify.
writeFileSync(join(out, 'dossier.json'), dossier);
console.log('Palmar Bay build OK ->', out);
