// Packs dist/ into release/hungry-seal-<version>-web.zip, ready to upload to itch.io as an
// HTML5 game (index.html at the zip root). `npm run release` builds and checks the build first.
// Plain zip writer (deflate via zlib) so it works the same on every OS without a zip tool.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const DIST = 'dist';
const OUT = path.join('release', `hungry-seal-${pkg.version}-web.zip`);

async function list(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await list(full)));
    else out.push(full);
  }
  return out.sort();
}

const files = await list(DIST);
if (!files.some((f) => path.relative(DIST, f) === 'index.html')) {
  console.error('dist/index.html missing: run `npm run build` first');
  process.exit(1);
}

const locals = [];
const centrals = [];
let offset = 0;
// DOS date/time for "now" (zip entries need one).
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
for (const file of files) {
  const name = Buffer.from(path.relative(DIST, file).split(path.sep).join('/'));
  const data = await readFile(file);
  const packed = deflateRawSync(data, { level: 9 });
  // Already-compressed files (WebP, woff2, PNG) are stored as they are.
  const useDeflate = packed.length < data.length;
  const body = useDeflate ? packed : data;
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(useDeflate ? 8 : 0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  locals.push(header, name, body);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(useDeflate ? 8 : 0, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);
  offset += header.length + name.length + body.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

await mkdir('release', { recursive: true });
await writeFile(OUT, Buffer.concat([...locals, ...centrals, end]));
const size = (await stat(OUT)).size;
console.log(`${OUT}: ${files.length} files, ${(size / 1048576).toFixed(2)} MB`);
