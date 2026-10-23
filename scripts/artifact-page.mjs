/**
 * Convierte el index.html de una compilación (vite build --mode demo) en el fragmento que espera
 * el visor de Artifacts: sin doctype/html/head/body (los pone el visor), con <title> al principio y
 * los recursos con rutas relativas. Escribe <dir>/artifact.html.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2] ?? 'dist-demo';
const html = readFileSync(`${dir}/index.html`, 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+)"/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="\.?\/?([^"]+)"/g)].map((m) => m[1]);
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (!css.length || !js.length) throw new Error('No encuentro los recursos compilados');

const page = `<title>FloraGuessr</title>
<meta name="claude:viewport-fit-sides" content="cover">
${css.map((h) => `<link rel="stylesheet" href="${h}">`).join('\n')}
${body}
${js.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
writeFileSync(`${dir}/artifact.html`, page);
const assets = readdirSync(`${dir}/assets`).filter((f) => !f.endsWith('.woff'));
writeFileSync(`${dir}/artifact-files.json`, JSON.stringify(Object.fromEntries(assets.map((f) => [`assets/${f}`, `${dir}/assets/${f}`])), null, 1));
console.log(`${dir}/artifact.html · ${assets.length} recursos`);
