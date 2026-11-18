// Rodar:  node --test testes/sw.test.mjs
// Garante que o pré-cache do sw.js cobre tudo o que a área de aprendizagem precisa offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
const assets = [...sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS'))).matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);

test('S1. todo item do pré-cache existe de verdade (senão a instalação do SW falharia)', () => {
  for (const a of assets) assert.ok(a === '' || existsSync(join(RAIZ, a)), `não existe: ${a}`);
  assert.equal(new Set(assets).size, assets.length, 'itens duplicados');
});

test('S2. a área de aprendizagem e TODOS os módulos estão no pré-cache', () => {
  const modulos = readdirSync(join(RAIZ, 'dados', 'modulos')).map(f => `dados/modulos/${f}`);
  assert.equal(modulos.length, 10);
  for (const a of ['jornada/', 'jornada/index.html', 'jornada/jornada.css', 'jornada/js/app.js', 'jornada/js/acordes.js', 'jornada/js/store.js', 'dados/modulos.json', ...modulos])
    assert.ok(assets.includes(a), `fora do pré-cache: ${a}`);
});

test('S3. o que já funcionava continua no pré-cache (afinador, metrônomo, home, ícones)', () => {
  for (const a of ['', 'index.html', 'manifest.webmanifest', 'css/base.css', 'css/home.css', 'js/pwa.js', 'afinador/', 'afinador/index.html',
    'metronomo/', 'metronomo/index.html', 'metronomo/metronomo.css', 'metronomo/metronomo.js', 'icons/icon-192.png', 'icons/icon-512.png',
    'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']) assert.ok(assets.includes(a), `removido do pré-cache: ${a}`);
});

test('S4. cache versionado novo (v2) e testes/ não vão para o cache do aluno', () => {
  const v = Number((sw.match(/const VERSION = 'v(\d+)'/) || [])[1]);
  assert.ok(v >= 3, `VERSION deve ser v3 ou maior após a mudança de conteúdo do P0 (atual: v${v})`);
  assert.match(sw, /const PREFIX = 'violao-descomplicado-'/);
  assert.ok(!assets.some(a => a.startsWith('testes/') || a.endsWith('.mjs')));
});
