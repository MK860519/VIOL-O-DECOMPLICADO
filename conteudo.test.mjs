// Rodar:  node --test jornada/testes/conteudo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { criarStore, idAulaValido } from '../jornada/js/store.js';
import { validarConteudo } from './validar-conteudo.mjs';

const DADOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'dados');
const ler = p => JSON.parse(readFileSync(join(DADOS, p), 'utf8'));
const carregar = () => {
  const indice = ler('modulos.json'), modulos = {};
  for (const m of indice.modulos) modulos[m.id] = ler(m.arquivo);
  return { indice, modulos, jornada: ler('jornada-30-dias.json') };
};
const clone = o => JSON.parse(JSON.stringify(o));
const memStorage = () => { const d = new Map(); return { d, getItem: k => d.get(k) ?? null, setItem: (k, v) => d.set(k, String(v)) }; };

test('1. arquivos: existem, são JSON válido e têm nomes em minúsculas (GitHub Pages)', () => {
  const arquivos = ['modulos.json', 'jornada-30-dias.json', ...Array.from({ length: 10 }, (_, i) => `modulos/m${String(i + 1).padStart(2, '0')}.json`)];
  for (const a of arquivos) { assert.ok(existsSync(join(DADOS, a)), a); assert.doesNotThrow(() => ler(a), a); assert.equal(a, a.toLowerCase()); assert.match(a, /^[a-z0-9\/.-]+$/); }
  assert.deepEqual(readdirSync(join(DADOS, 'modulos')).sort(), arquivos.filter(a => a.startsWith('modulos/')).map(a => a.slice(8)).sort(), 'sem arquivos órfãos');
});

test('2. o conteúdo atual passa em TODAS as validações estruturais', () => {
  assert.deepEqual(validarConteudo(carregar()), []);
});

test('3. 10 módulos, 30 aulas, progressão de nível do zero ao avançado', () => {
  const { indice, modulos } = carregar();
  assert.deepEqual(indice.modulos.map(m => m.id), Array.from({ length: 10 }, (_, i) => `m${String(i + 1).padStart(2, '0')}`));
  assert.equal(indice.modulos[0].nivel, 'Absoluto zero'); assert.equal(indice.modulos[9].nivel, 'Avançado');
  assert.equal(Object.values(modulos).reduce((n, m) => n + m.aulas.length, 0), 30);
});

test('4. toda aula tem título, introdução, explicação, conteúdo didático e orientação prática', () => {
  const { modulos } = carregar();
  for (const m of Object.values(modulos)) for (const a of m.aulas)
    for (const c of ['titulo', 'introducao', 'explicacao', 'conteudo']) assert.ok(a[c] && a[c].length, `${a.id}.${c}`), assert.ok(a.pratica.orientacao.length > 20, `${a.id}.pratica`);
});

test('5. jornada de 30 dias: dias 1..30, uma aula por dia, todas as aulas usadas uma vez, só referências', () => {
  const { jornada, modulos } = carregar();
  assert.deepEqual(jornada.dias.map(d => d.dia), Array.from({ length: 30 }, (_, i) => i + 1));
  const ids = jornada.dias.flatMap(d => d.aulas), todas = Object.values(modulos).flatMap(m => m.aulas.map(a => a.id));
  assert.deepEqual([...ids].sort(), [...todas].sort());
  for (const d of jornada.dias) assert.deepEqual(Object.keys(d).sort(), ['aulas', 'dia']);
});

test('6. sem duplicação: textos únicos e nada copiado para o índice ou a jornada', () => {
  const { indice, modulos } = carregar();
  const aulas = Object.values(modulos).flatMap(m => m.aulas);
  for (const c of ['titulo', 'introducao', 'explicacao']) assert.equal(new Set(aulas.map(a => a[c].toLowerCase())).size, aulas.length, c);
  for (const m of indice.modulos) assert.deepEqual(Object.keys(m).sort(), ['arquivo', 'id', 'nivel', 'origem', 'resumo', 'titulo']);
  for (const mod of Object.values(modulos)) assert.deepEqual(Object.keys(mod).sort(), ['aulas', 'id']);
});

test('7. compatível com o store aprovado: todos os ids e dias são aceitos e o progresso chega a 100%', () => {
  const { jornada, modulos } = carregar(), st = memStorage(), s = criarStore({ storage: st, hoje: () => '2026-11-05' });
  const ids = Object.values(modulos).flatMap(m => m.aulas.map(a => a.id));
  for (const id of ids) { assert.ok(idAulaValido(id), id); assert.equal(s.atualizarUltima(id).ok, true); }
  assert.deepEqual(s.estado().aulas, {}, 'abrir aulas não conclui nenhuma');
  for (const id of ids) assert.equal(s.concluirAula(id).ok, true, id);
  for (const d of jornada.dias) assert.equal(s.concluirDia(d.dia).ok, true, String(d.dia));
  const e = s.estado();
  assert.equal(Object.keys(e.aulas).length, 30); assert.equal(Object.keys(e.dias).length, 30);
  const reaberto = criarStore({ storage: st, hoje: () => '2026-11-05' }).carregar();
  assert.equal(Object.keys(reaberto.aulas).length, 30, 'sobrevive a recarregar');
  for (const m of Object.values(modulos)) assert.ok(m.aulas.every(a => reaberto.aulas[a.id]), `${m.id} 100%`);
});

test('8. ferramentas das aulas respeitam os limites reais do metrônomo (40–240 BPM; 2/4, 3/4, 4/4)', () => {
  const { modulos } = carregar(); let metro = 0, afin = 0;
  for (const m of Object.values(modulos)) for (const a of m.aulas) { const f = a.pratica.ferramenta; if (!f) continue;
    if (f.tipo === 'metronomo') { metro++; assert.ok(f.bpm >= 40 && f.bpm <= 240 && [2, 3, 4].includes(f.compasso), a.id); } else afin++; }
  assert.ok(metro >= 10 && afin >= 1, `metrônomo em ${metro} aulas, afinador em ${afin}`);
});

test('9. o validador REALMENTE detecta defeitos (21 defeitos injetados)', () => {
  const base = carregar();
  const casos = {
    'módulo a menos':            d => d.indice.modulos.pop(),
    'id de aula fora do padrão': d => { d.modulos.m01.aulas[0].id = 'aula-1'; },
    'aula sem introdução':       d => { delete d.modulos.m02.aulas[0].introducao; },
    'aula sem prática':          d => { delete d.modulos.m03.aulas[1].pratica; },
    'conteúdo vazio':            d => { d.modulos.m04.aulas[0].conteudo = []; },
    'bloco de tipo desconhecido':d => { d.modulos.m05.aulas[0].conteudo.push({ tipo: 'video' }); },
    'acorde com 5 cordas':       d => { d.modulos.m03.aulas[0].conteudo[0].cordas.pop(); },
    'dedo em corda solta':       d => { d.modulos.m03.aulas[0].conteudo[0].dedos[0] = 2; },
    'bpm fora do limite':        d => { d.modulos.m04.aulas[0].pratica.ferramenta.bpm = 300; },
    'compasso 5/4':              d => { d.modulos.m04.aulas[0].pratica.ferramenta.compasso = 5; },
    'título duplicado':          d => { d.modulos.m02.aulas[1].titulo = d.modulos.m02.aulas[0].titulo; },
    'dia 31 na jornada':         d => { d.jornada.dias[29].dia = 31; },
    'aula inexistente no dia':   d => { d.jornada.dias[4].aulas = ['m09-a09']; },
    'texto copiado na jornada':  d => { d.jornada.dias[0].titulo = 'cópia'; },
    'sem objetivo':              d => { delete d.modulos.m01.aulas[0].objetivo; },
    'sem bloco de exemplo':      d => { d.modulos.m02.aulas[0].conteudo = d.modulos.m02.aulas[0].conteudo.filter(b => b.tipo !== 'exemplo'); },
    'só 1 exercício':            d => { d.modulos.m03.aulas[0].pratica.exercicios = ['apenas um exercício aqui']; },
    'sem erros comuns':          d => { d.modulos.m04.aulas[0].errosComuns = []; },
    'sem desafio':               d => { delete d.modulos.m05.aulas[0].desafio; },
    'sem critério de avanço':    d => { delete d.modulos.m06.aulas[0].criterioAvancar; },
    'aula rasa':                 d => { const a = d.modulos.m07.aulas[0]; a.introducao = 'Texto curto demais para uma aula completa.'.repeat(1); a.explicacao = a.explicacao.slice(0, 45); a.conteudo = a.conteudo.slice(0, 1).concat(a.conteudo.filter(b => b.tipo === 'exemplo')); a.pratica.exercicios = ['exercício curto numero um', 'exercício curto numero dois']; a.errosComuns = [{ problema: 'problema curto aqui', solucao: 'solução curta para o problema' }]; a.objetivo = 'objetivo curto, mas com tamanho ok'; a.desafio = 'desafio curto, mas com tamanho ok!!'; a.criterioAvancar = 'critério curto, mas com tamanho ok!'; a.pratica.orientacao = 'orientação curta mas ok aqui sim'; },
  };
  for (const [nome, f] of Object.entries(casos)) {
    const d = clone(base); f(d);
    assert.ok(validarConteudo(d).length > 0, `não detectou: ${nome}`);
  }
});

const IDS_ORIGINAIS = Array.from({ length: 10 }, (_, m) => [1, 2, 3].map(a => `m${String(m + 1).padStart(2, '0')}-a${String(a).padStart(2, '0')}`)).flat();

test('10. IDs das 30 aulas IMUTÁVEIS (o progresso dos alunos continua valendo)', () => {
  const { modulos, jornada } = carregar();
  assert.deepEqual(Object.values(modulos).flatMap(m => m.aulas.map(a => a.id)), IDS_ORIGINAIS);
  assert.deepEqual(jornada.dias.flatMap(d => d.aulas), IDS_ORIGINAIS);
  // progresso gravado ANTES desta versão continua sendo lido integralmente
  const st = memStorage(); const antigo = { v: 1, aulas: { 'm01-a01': '2026-11-01', 'm03-a02': '2026-11-03' }, dias: { 1: '2026-11-01' }, inicio: '2026-11-01', ultima: 'm03-a02' };
  st.setItem('violao-descomplicado-progresso', JSON.stringify(antigo));
  assert.deepEqual(criarStore({ storage: st }).carregar(), antigo);
});

test('11. as 30 aulas têm TODOS os elementos pedagógicos (objetivo, exemplo, exercícios, erros, desafio, critério)', () => {
  const { modulos } = carregar(); let n = 0;
  for (const a of Object.values(modulos).flatMap(m => m.aulas)) {
    n++;
    assert.ok(a.objetivo.length >= 25, `${a.id} objetivo`); assert.ok(a.conteudo.some(b => b.tipo === 'exemplo'), `${a.id} exemplo`);
    assert.ok(a.pratica.exercicios.length >= 2, `${a.id} exercícios`); assert.ok(a.errosComuns.length >= 1, `${a.id} erros`);
    assert.ok(a.desafio.length >= 25, `${a.id} desafio`); assert.ok(a.criterioAvancar.length >= 25, `${a.id} critério`);
  }
  assert.equal(n, 30);
});

test('12. sequência didática: nada é usado antes de ser explicado', () => {
  const { modulos } = carregar(), aulas = Object.values(modulos).flatMap(m => m.aulas);
  const t = a => [a.titulo, a.introducao, a.explicacao, a.pratica.orientacao, ...a.conteudo.flatMap(b => [b.texto, ...(b.itens || [])])].filter(Boolean).join(' ');
  const primeira = rx => aulas.findIndex(a => rx.test(t(a)));
  const ate = (i, rx) => aulas.slice(0, i + 1).some(a => rx.test(t(a)));
  assert.ok(ate(primeira(/metrônomo|BPM|clique/i), /batidas por minuto/i), 'BPM/metrônomo usados antes de explicados');
  assert.ok(ate(primeira(/\bmenor\b/i), /menor[\s\S]*(sério|triste)/i), '"menor" usado antes de explicado');
  const iE = aulas.findIndex(a => a.id === 'm03-a03');
  for (const a of aulas.slice(0, iE)) assert.ok(!/Mi maior/.test(t(a)), `${a.id} cita o Mi maior antes de ele ser ensinado`);
  const am = aulas.find(a => a.id === 'm03-a02'); assert.match(t(am), /Mi menor/);
});

test('13. título coerente com o conteúdo (não promete o que a aula não entrega)', () => {
  const { modulos } = carregar(), aulas = Object.values(modulos).flatMap(m => m.aulas);
  const t = a => JSON.stringify(a.conteudo) + a.explicacao + a.pratica.orientacao;
  for (const a of aulas) {
    if (/dedos/i.test(a.titulo) && a.id === 'm02-a02') assert.match(t(a), /polegar/, `${a.id} promete dedos`);
    if (/música/i.test(a.titulo)) assert.ok(a.conteudo.some(b => b.tipo === 'cifra'), `${a.id}: o título promete música, mas a aula não tem letra e cifra`);
  }
  assert.ok(!/dedos/i.test(aulas.find(a => a.id === 'm02-a02').titulo), 'título do dia 5 ainda promete "dedos"');
});
