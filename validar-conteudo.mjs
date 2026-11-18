// Validador do conteúdo (módulos, aulas e jornada). Devolve a lista de erros; vazia = tudo certo.
import { idAulaValido, normalizarDia } from '../jornada/js/store.js';

const TIPOS_BLOCO = ['texto', 'passos', 'dica', 'acorde', 'exemplo'];
const MIN_PALAVRAS = 150; // profundidade mínima de uma aula completa
const NIVEIS = ['Absoluto zero', 'Iniciante', 'Intermediário', 'Avançado'];
const txt = (x, min = 1) => typeof x === 'string' && x.trim().length >= min;

export function validarConteudo({ indice, modulos, jornada }) {
  const erros = [], err = m => erros.push(m);
  const aulaIds = new Set();
  const vistos = { titulo: new Map(), introducao: new Map(), explicacao: new Map(), objetivo: new Map(), desafio: new Map(), criterioAvancar: new Map() };
  const dup = (campo, valor, onde) => {
    const k = valor.trim().toLowerCase();
    if (vistos[campo].has(k)) err(`${onde}: ${campo} repetido(a) de ${vistos[campo].get(k)}`); else vistos[campo].set(k, onde);
  };

  if (!indice || !Array.isArray(indice.modulos)) return ['modulos.json: lista "modulos" ausente'];
  if (indice.modulos.length !== 10) err(`modulos.json: esperados 10 módulos, achei ${indice.modulos.length}`);
  let nivelAnterior = -1;
  indice.modulos.forEach((m, i) => {
    const mid = `m${String(i + 1).padStart(2, '0')}`;
    if (m.id !== mid) err(`modulos.json[${i}]: id deveria ser ${mid}, é ${m.id}`);
    if (!txt(m.titulo, 3)) err(`${m.id}: titulo ausente`);
    if (!txt(m.resumo, 10)) err(`${m.id}: resumo ausente`);
    if (!['rascunho', 'ebook'].includes(m.origem)) err(`${m.id}: origem deve ser "rascunho" ou "ebook"`);
    const n = NIVEIS.indexOf(m.nivel);
    if (n < 0) err(`${m.id}: nivel inválido (${m.nivel})`);
    if (n < nivelAnterior) err(`${m.id}: nível volta atrás (a progressão deve ser crescente)`);
    nivelAnterior = Math.max(nivelAnterior, n);
    if (m.arquivo !== `modulos/${m.id}.json`) err(`${m.id}: arquivo deve ser modulos/${m.id}.json`);
    for (const proibido of ['aulas', 'totalAulas']) if (proibido in m) err(`${m.id}: "${proibido}" não pode ficar no índice (duplicaria dados)`);

    const dados = modulos[m.id];
    if (!dados) return err(`${m.id}: arquivo do módulo não encontrado`);
    if (dados.id !== m.id) err(`${m.id}: o arquivo declara id ${dados.id}`);
    if ('titulo' in dados) err(`${m.id}: título do módulo só pode existir em modulos.json`);
    if (!Array.isArray(dados.aulas) || dados.aulas.length < 3) return err(`${m.id}: precisa de pelo menos 3 aulas`);

    dados.aulas.forEach((a, j) => {
      const aid = `${m.id}-a${String(j + 1).padStart(2, '0')}`, onde = a && a.id || aid;
      if (a.id !== aid) err(`${onde}: id deveria ser ${aid} (sequencial)`);
      if (!idAulaValido(a.id)) err(`${onde}: id não é aceito pelo store.js`);
      if (aulaIds.has(a.id)) err(`${onde}: id duplicado`); aulaIds.add(a.id);
      if (!txt(a.titulo, 3)) err(`${onde}: sem titulo`); else dup('titulo', a.titulo, onde);
      if (!txt(a.introducao, 30)) err(`${onde}: introducao ausente ou curta demais`); else dup('introducao', a.introducao, onde);
      if (!txt(a.explicacao, 40)) err(`${onde}: explicacao ausente ou curta demais`); else dup('explicacao', a.explicacao, onde);
      if (!Number.isInteger(a.duracaoMin) || a.duracaoMin < 3 || a.duracaoMin > 45) err(`${onde}: duracaoMin inválida`);
      if (!Array.isArray(a.conteudo) || a.conteudo.length < 1) err(`${onde}: conteudo didático vazio`);
      else a.conteudo.forEach((b, k) => {
        const o = `${onde}.conteudo[${k}]`;
        if (!b || !TIPOS_BLOCO.includes(b.tipo)) return err(`${o}: tipo de bloco inválido (${b && b.tipo})`);
        if ((b.tipo === 'texto' || b.tipo === 'dica') && !txt(b.texto, 5)) err(`${o}: texto vazio`);
        if (b.tipo === 'exemplo' && !txt(b.texto, 25)) err(`${o}: exemplo ausente ou curto demais`);
        if (b.tipo === 'passos' && !(Array.isArray(b.itens) && b.itens.length >= 2 && b.itens.every(i => txt(i, 3)))) err(`${o}: passos precisa de 2+ itens de texto`);
        if (b.tipo === 'acorde') {
          const ok = (v, mn, mx) => Array.isArray(v) && v.length === 6 && v.every(x => Number.isInteger(x) && x >= mn && x <= mx);
          if (!txt(b.nome, 1)) err(`${o}: acorde sem nome`);
          if (!ok(b.cordas, -1, 12)) err(`${o}: "cordas" deve ter 6 inteiros entre -1 e 12`);
          if (!ok(b.dedos, 0, 4)) err(`${o}: "dedos" deve ter 6 inteiros entre 0 e 4`);
          else if (ok(b.cordas, -1, 12) && b.cordas.some((c, x) => (c <= 0) !== (b.dedos[x] === 0) && !(c > 0 && b.dedos[x] > 0)))
            err(`${o}: "dedos" não combina com "cordas" (corda solta/abafada sem dedo; corda pressionada com dedo)`);
        }
      });
      if (!txt(a.objetivo, 25)) err(`${onde}: objetivo ("o que o aluno vai aprender") ausente`); else dup('objetivo', a.objetivo, onde);
      if (Array.isArray(a.conteudo) && !a.conteudo.some(b => b && b.tipo === 'exemplo')) err(`${onde}: falta pelo menos 1 bloco de exemplo`);
      if (!Array.isArray(a.errosComuns) || a.errosComuns.length < 1 || a.errosComuns.length > 3 || !a.errosComuns.every(e => e && txt(e.problema, 8) && txt(e.solucao, 15))) err(`${onde}: errosComuns precisa de 1 a 3 itens {problema, solucao}`);
      if (!txt(a.desafio, 25)) err(`${onde}: desafio ausente`); else dup('desafio', a.desafio, onde);
      if (!txt(a.criterioAvancar, 25)) err(`${onde}: criterioAvancar ausente`); else dup('criterioAvancar', a.criterioAvancar, onde);
      const p = a.pratica;
      if (!p || !txt(p.orientacao, 20)) err(`${onde}: pratica.orientacao ausente`);
      else {
        if (!Array.isArray(p.exercicios) || p.exercicios.length < 2 || p.exercicios.length > 4 || !p.exercicios.every(x => txt(x, 15))) err(`${onde}: pratica.exercicios precisa de 2 a 4 exercícios`);
        if (!Number.isInteger(p.minutos) || p.minutos < 1 || p.minutos > 60) err(`${onde}: pratica.minutos inválido`);
        const f = p.ferramenta;
        if (f !== undefined) {
          if (!f || !['afinador', 'metronomo'].includes(f.tipo)) err(`${onde}: ferramenta.tipo inválido`);
          else if (f.tipo === 'metronomo') {
            if (!Number.isInteger(f.bpm) || f.bpm < 40 || f.bpm > 240) err(`${onde}: bpm fora de 40–240`);
            if (![2, 3, 4].includes(f.compasso)) err(`${onde}: compasso deve ser 2, 3 ou 4`);
          }
        }
      }
      const texto = [a.objetivo, a.introducao, a.explicacao, a.desafio, a.criterioAvancar, p && p.orientacao, ...(p && p.exercicios || []),
        ...(a.errosComuns || []).flatMap(e => [e && e.problema, e && e.solucao]), ...(a.conteudo || []).flatMap(b => [b.texto, ...(b.itens || [])])].filter(Boolean).join(' ');
      if (texto.split(/\s+/).length < MIN_PALAVRAS) err(`${onde}: aula rasa demais (menos de ${MIN_PALAVRAS} palavras)`);
    });
  });

  // Jornada: só referências. Nenhum texto de aula pode ser copiado para cá.
  if (!jornada || !Array.isArray(jornada.dias)) return [...erros, 'jornada-30-dias.json: lista "dias" ausente'];
  if (jornada.dias.length !== 30) err(`jornada: esperados 30 dias, achei ${jornada.dias.length}`);
  const usadas = new Set();
  jornada.dias.forEach((d, i) => {
    if (normalizarDia(d.dia) !== i + 1 || d.dia !== i + 1) err(`jornada[${i}]: dia deveria ser ${i + 1}`);
    for (const k of Object.keys(d)) if (!['dia', 'aulas'].includes(k)) err(`jornada dia ${d.dia}: campo "${k}" não permitido (evita duplicar conteúdo)`);
    if (!Array.isArray(d.aulas) || d.aulas.length < 1) return err(`jornada dia ${d.dia}: sem aulas`);
    d.aulas.forEach(id => {
      if (!aulaIds.has(id)) err(`jornada dia ${d.dia}: aula inexistente (${id})`);
      if (usadas.has(id)) err(`jornada dia ${d.dia}: aula ${id} aparece em mais de um dia`);
      usadas.add(id);
    });
  });
  for (const id of aulaIds) if (!usadas.has(id)) err(`aula ${id} não está em nenhum dia da jornada`);
  return erros;
}
