/* Aprenda Violão — telas de módulos, aulas e conteúdo.
   Fonte de dados: ../dados/*.json (nada é copiado para cá). Progresso: store.js (localStorage).
   Rotas (hash):  #/  ·  #/modulo/m03  ·  #/aula/m03-a02 */
import { store, idAulaValido } from './store.js';
import { diagramaAcorde } from './acordes.js';

const app = document.getElementById('app');
const RE_MOD = /^m(0[1-9]|10)$/;
let dados = null;

/* Cria elementos com textContent (nunca innerHTML): o conteúdo dos JSON não vira HTML. */
function h(tag, props, ...filhos) {
  const e = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  e.append(...filhos.flat().filter(f => f != null && f !== false));
  return e;
}

async function carregarDados() {
  if (dados) return dados;
  const ler = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
  const indice = await ler('../dados/modulos.json');
  const arquivos = await Promise.all(indice.modulos.map(m => ler('../dados/' + m.arquivo)));
  const modulos = {}, ordem = [];
  indice.modulos.forEach((m, i) => {
    modulos[m.id] = { ...m, aulas: arquivos[i].aulas };
    arquivos[i].aulas.forEach(a => ordem.push(a));
  });
  dados = { lista: indice.modulos.map(m => modulos[m.id]), modulos, ordem };
  return dados;
}

const feitas = mod => mod.aulas.filter(a => store.aulaConcluida(a.id)).length;
const barra = (n, total) => h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': n }, (() => {
  const i = h('i'); i.style.width = (total ? Math.round(100 * n / total) : 0) + '%'; return i;
})());
const voltar = (href, rotulo) => h('a', { class: 'voltar', href }, '‹ ' + rotulo);

function aviso() {
  if (store.somenteLeitura) return h('p', { class: 'aviso', role: 'status' }, 'Seu progresso foi salvo por uma versão mais nova do aplicativo. Atualize o app para continuar registrando.');
  if (!store.persistente) return h('p', { class: 'aviso', role: 'status' }, 'Seu navegador não permite salvar o progresso neste aparelho. Ele será perdido ao fechar o app.');
  return null;
}

/** Primeira aula ainda não concluída, a partir da última aberta (volta ao início se necessário). */
function proximaAula() {
  const { ordem } = dados, ult = store.estado().ultima;
  const ini = Math.max(0, ordem.findIndex(a => a.id === ult));
  for (let k = 0; k < ordem.length; k++) {
    const a = ordem[(ini + k) % ordem.length];
    if (!store.aulaConcluida(a.id)) return a;
  }
  return null;
}

/* ---------- telas ---------- */

function telaInicio() {
  const { lista, ordem } = dados, total = ordem.length, feito = ordem.filter(a => store.aulaConcluida(a.id)).length;
  const prox = proximaAula(), comecou = feito > 0 || store.estado().ultima;
  return [
    voltar('../', 'Início'),
    h('h1', { tabindex: '-1' }, 'Aprenda Violão'),
    h('p', { class: 'sub' }, 'Do absoluto zero ao avançado, um passo de cada vez.'),
    aviso(),
    h('section', { class: 'painel', 'aria-label': 'Seu progresso' },
      h('b', null, `${feito} de ${total} aulas concluídas`), barra(feito, total),
      prox ? h('a', { class: 'btn principal', href: `#/aula/${prox.id}` }, comecou ? 'Continuar de onde parei' : 'Começar a primeira aula')
           : h('p', { style: 'margin:14px 0 0;color:var(--green);font-weight:700' }, 'Parabéns! Você concluiu todas as aulas.')),
    h('h2', null, 'Módulos'),
    h('ul', { class: 'lista' }, lista.map((m, i) => h('li', null,
      h('a', { class: 'item', href: `#/modulo/${m.id}` },
        h('span', { class: 'tag' }, `Módulo ${i + 1} · ${m.nivel}`), h('h3', null, m.titulo), h('small', null, m.resumo),
        barra(feitas(m), m.aulas.length), h('small', null, `${feitas(m)} de ${m.aulas.length} aulas`))))),
    lista.some(m => m.origem === 'rascunho') ? h('p', { class: 'rodape' }, 'Conteúdo em versão preliminar.') : null,
  ];
}

function telaModulo(id) {
  const m = dados.modulos[id], n = dados.lista.indexOf(m) + 1;
  return [
    voltar('#/', 'Módulos'),
    h('p', { class: 'sub', style: 'margin:0' }, `Módulo ${n} · ${m.nivel}`),
    h('h1', { tabindex: '-1' }, m.titulo), h('p', { class: 'sub' }, m.resumo),
    aviso(), barra(feitas(m), m.aulas.length),
    h('h2', null, 'Aulas'),
    h('ul', { class: 'lista' }, m.aulas.map((a, i) => {
      const f = store.aulaConcluida(a.id);
      return h('li', null, h('a', { class: 'item aula' + (f ? ' feita' : ''), href: `#/aula/${a.id}` },
        h('span', { class: 'ok', 'aria-hidden': 'true' }, f ? '✓' : ''),
        h('div', null, h('h3', null, `${i + 1}. ${a.titulo}`), h('small', null, `${a.duracaoMin} min${f ? ' · concluída' : ''}`))));
    })),
  ];
}

function bloco(b) {
  if (b.tipo === 'texto') return h('p', null, b.texto);
  if (b.tipo === 'dica') return h('div', { class: 'dica' }, h('strong', null, 'Dica: '), b.texto);
  if (b.tipo === 'exemplo') return h('div', { class: 'exemplo' }, h('strong', null, 'Exemplo: '), b.texto);
  if (b.tipo === 'passos') return h('ol', { class: 'passos' }, b.itens.map(i => h('li', null, i)));
  if (b.tipo === 'acorde') return h('figure', { class: 'acorde-fig' }, diagramaAcorde(b), h('figcaption', null, b.nome));
  return null;
}

function ferramenta(f) {
  if (!f) return null;
  if (f.tipo === 'afinador') return h('a', { class: 'btn', href: '../afinador/' }, 'Abrir o afinador');
  const link = h('a', { class: 'btn', href: '../metronomo/' }, `Abrir o metrônomo a ${f.bpm} BPM (${f.compasso}/4)`);
  // O metrônomo lê a velocidade salva em "vd-metro" ao abrir; não é preciso alterar o metrônomo.
  link.addEventListener('click', () => { try { localStorage.setItem('vd-metro', JSON.stringify({ bpm: f.bpm, beats: f.compasso })); } catch (e) {} });
  return link;
}

function telaAula(id) {
  const { ordem, modulos } = dados, i = ordem.findIndex(a => a.id === id), a = ordem[i], m = modulos[id.slice(0, 3)];
  const pos = m.aulas.indexOf(a) + 1, ant = ordem[i - 1], prox = ordem[i + 1];
  store.atualizarUltima(id); // só registra a última aula aberta; NÃO conclui
  const msg = h('p', { class: 'msg', role: 'status' });
  const btn = h('button', { class: 'btn principal', type: 'button' });
  const pintar = () => {
    const f = store.aulaConcluida(id);
    btn.textContent = f ? '✓ Aula concluída (toque para desmarcar)' : 'Concluir aula';
    btn.setAttribute('aria-pressed', String(f)); btn.classList.toggle('feita', f);
  };
  btn.addEventListener('click', () => {
    const r = store.aulaConcluida(id) ? store.desmarcarAula(id) : store.concluirAula(id);
    msg.textContent = !r.ok ? (r.erro === 'somente-leitura' ? 'Atualize o aplicativo para registrar o progresso.' : 'Não foi possível registrar.')
      : !r.persistido ? 'Atenção: o progresso não pôde ser salvo neste aparelho.' : '';
    pintar();
  });
  pintar();
  const p = a.pratica, nav = (x, rot, cls) => x ? h('a', { class: 'btn', href: `#/aula/${x.id}` }, rot) : h('span', { class: 'btn vazio' });
  return [
    voltar(`#/modulo/${m.id}`, m.titulo),
    h('p', { class: 'sub', style: 'margin:0' }, `Aula ${pos} de ${m.aulas.length} · ${a.duracaoMin} min`),
    h('h1', { tabindex: '-1' }, a.titulo), aviso(),
    a.objetivo ? h('div', { class: 'objetivo' }, h('strong', null, 'O que você vai aprender: '), a.objetivo) : null,
    h('h2', null, 'Introdução'), h('p', null, a.introducao),
    h('h2', null, 'Explicação'), h('p', null, a.explicacao),
    h('h2', null, 'Conteúdo'), ...a.conteudo.map(bloco),
    h('section', { class: 'pratica' }, h('h2', { style: 'margin-top:0' }, 'Prática'), h('p', null, p.orientacao),
      p.exercicios ? [h('h3', { class: 'ex-tit' }, 'Exercícios'), h('ol', { class: 'passos' }, p.exercicios.map(x => h('li', null, x)))] : null,
      h('p', { class: 'sub' }, `Tempo sugerido: ${p.minutos} min`), ferramenta(p.ferramenta)),
    a.errosComuns ? [h('h2', null, 'Erros comuns'), h('ul', { class: 'erros' }, a.errosComuns.map(e => h('li', null, h('strong', null, e.problema), h('span', null, e.solucao))))] : null,
    a.desafio ? [h('h2', null, 'Desafio'), h('p', null, a.desafio)] : null,
    a.criterioAvancar ? h('div', { class: 'criterio' }, h('strong', null, 'Para avançar: '), a.criterioAvancar) : null,
    btn, msg,
    h('nav', { class: 'nav', 'aria-label': 'Navegação entre aulas' }, nav(ant, '‹ Anterior'), nav(prox, 'Próxima ›')),
  ];
}

function naoEncontrado() {
  return [voltar('#/', 'Módulos'), h('h1', { tabindex: '-1' }, 'Conteúdo não encontrado'),
    h('p', { class: 'sub' }, 'Esta página não existe. Volte para a lista de módulos.'), h('a', { class: 'btn principal', href: '#/' }, 'Ver módulos')];
}

/* ---------- roteador ---------- */

async function renderizar() {
  const [, tipo, id] = location.hash.replace(/^#/, '').split('/');
  let telas, titulo = 'Aprenda Violão';
  try {
    await carregarDados();
    store.estado(); // garante a leitura do localStorage (e os avisos de armazenamento)
    if (!tipo) telas = telaInicio();
    else if (tipo === 'modulo' && RE_MOD.test(id) && dados.modulos[id]) { telas = telaModulo(id); titulo = dados.modulos[id].titulo; }
    else if (tipo === 'aula' && idAulaValido(id) && dados.ordem.some(a => a.id === id)) { telas = telaAula(id); titulo = dados.ordem.find(a => a.id === id).titulo; }
    else telas = naoEncontrado();
  } catch (e) {
    telas = [voltar('../', 'Início'), h('h1', { tabindex: '-1' }, 'Não foi possível carregar'),
      h('p', { class: 'sub' }, 'Abra o aplicativo uma vez com internet para guardar as aulas no aparelho.'),
      (() => { const r = h('button', { class: 'btn principal', type: 'button' }, 'Tentar de novo'); r.addEventListener('click', () => location.reload()); return r; })()];
  }
  document.title = titulo + ' · Violão Descomplicado';
  app.replaceChildren(...telas.flat().filter(Boolean));
  window.scrollTo(0, 0);
  const t = app.querySelector('h1'); if (t) t.focus({ preventScroll: true });
}

addEventListener('hashchange', renderizar);
renderizar();
