// Talks to Blender through the official Blender Lab MCP server (stdio), so art scripts can be
// run from the terminal without an MCP-aware client. Blender must be open with the MCP add-on
// serving localhost:9876, and `uv` installed (the server is fetched with uvx, pinned below).
//
//   node tools/blender/bridge.mjs exec tools/blender/seal.py   run a Python file in Blender
//   node tools/blender/bridge.mjs get_objects_summary '{}'     call any MCP tool with JSON args
//
// Scripts get `REPO` (this repo's root) defined, and must set `result` to a dict.
// Warning from Blender: the add-on runs this code unguarded, so only run scripts you trust.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER =
  'git+https://projects.blender.org/lab/blender_mcp.git@dbbf836ad4b1025f14a2b3b504c43903f39e0b04#subdirectory=mcp';
const TIMEOUT_MS = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const [tool = 'get_objects_summary', arg = '{}'] = process.argv.slice(2);
const server = spawn(process.env.UVX ?? 'uvx', ['--from', SERVER, 'blender-mcp'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
server.on('error', (err) => {
  console.error(`Could not start the MCP server (is uv installed? set UVX to its path): ${err.message}`);
  process.exit(1);
});

let buf = '';
let nextId = 0;
const pending = new Map();
server.stdout.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // not JSON-RPC
    }
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  }
});
const write = (msg) => server.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
const request = (method, params) =>
  new Promise((res) => {
    const id = ++nextId;
    pending.set(id, res);
    write({ id, method, params });
  });

const timer = setTimeout(() => {
  console.error('Timed out waiting for Blender.');
  server.kill();
  process.exit(1);
}, TIMEOUT_MS);

await request('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'hungry-seal-bridge', version: '1' },
});
write({ method: 'notifications/initialized' });

const call =
  tool === 'exec'
    ? {
        name: 'execute_blender_code',
        arguments: { code: `REPO = ${JSON.stringify(REPO)}\n${readFileSync(arg, 'utf8')}` },
      }
    : { name: tool, arguments: JSON.parse(arg) };
const reply = await request('tools/call', call);
clearTimeout(timer);
server.kill();

const out = reply.result?.structuredContent ?? reply.result ?? reply.error;
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
process.exit(reply.error || reply.result?.isError ? 1 : 0);
