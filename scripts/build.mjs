import { mkdir,copyFile,writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist',{ recursive:true });
// An explicit allowlist keeps source, tests, migrations, and secrets out of public assets.
for (const file of ['index.html','style.css','app.js','access.js','daily-stats.js','sync-store.js','account-ui.js']) await copyFile(file,`dist/${file}`);
await build({ entryPoints:['src/account-client.js'],bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,outfile:'dist/account-client.js',legalComments:'none' });
await writeFile('dist/_routes.json',JSON.stringify({ version:1,include:['/api/*'],exclude:[] }));
await writeFile('dist/_headers',`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n`);
console.log('Built static assets and the account client in dist/.');
