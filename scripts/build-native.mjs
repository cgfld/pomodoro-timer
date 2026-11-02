import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist-native', { recursive: true });
for (const file of ['style.css','app.js','access.js','daily-stats.js','sync-store.js','account-ui.js','soundscapes.js']) {
  await copyFile(file, `dist-native/${file}`);
}
const html = (await readFile('index.html', 'utf8')).replace('<script src="account-client.js"', '<script src="native-runtime.js"></script>\n  <script src="account-client.js"');
await writeFile('dist-native/index.html', html);
await build({ entryPoints: ['src/native-runtime.js','src/account-client.js'], bundle: true, format: 'iife', platform: 'browser', target: ['es2022'], minify: true, outdir: 'dist-native', legalComments: 'none' });
console.log('Built bundled native frontend in dist-native/.');
