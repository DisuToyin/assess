import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../server/.env', import.meta.url);
if (!existsSync(file)) {
  const template = readFileSync(new URL('../server/.env.example', import.meta.url), 'utf8');
  writeFileSync(file, template.replace('replace-with-at-least-32-random-characters', randomBytes(48).toString('hex')).replace('replace-with-a-separate-random-secret', randomBytes(32).toString('hex')), {mode: 0o600});
  console.log('Created server/.env with unique secrets. Read ADMIN_REGISTRATION_SECRET there to register the administrator.');
} else console.log('Existing server/.env preserved.');
