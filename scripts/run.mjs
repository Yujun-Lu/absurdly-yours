import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] || 'dev';
if (!['dev', 'start', 'build', 'sample'].includes(command)) throw new Error('Use dev, start, build, or sample.');
const envFile = path.join(root, '.env.local');
// The explicit project-local file wins over unrelated inherited desktop credentials.
const env = { ...process.env, ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}) };
if (command === 'sample') env.AY_SAMPLE_MODE = 'true';
const action = command === 'sample' ? 'start' : command;
const args = [path.join(root, 'node_modules/next/dist/bin/next'), action];
if (action !== 'build') args.push('--hostname', '127.0.0.1');
if (command === 'sample') args.push('--port', process.env.PORT || '3001');
const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env });
child.on('error', () => { console.error('Could not start Next.js. Run npm ci first.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); });
