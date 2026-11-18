/* Violão Descomplicado — progresso do aluno (somente no aparelho, via localStorage).

   Formato salvo na chave "violao-descomplicado-progresso":
     { "v": 1, "aulas": { "m03-a02": "2026-11-05" }, "dias": { "12": "2026-11-05" },
       "inicio": "2026-11-01" | null, "ultima": "m03-a02" | null }

   Regras:
   - Abrir uma aula (atualizarUltima) NUNCA a marca como concluída; só concluirAula/concluirDia fazem isso.
   - Tudo o que vem do localStorage é validado; o que for inválido é descartado, o que for válido é mantido.
   - Falha de armazenamento (bloqueado, cheio, JSON quebrado) nunca lança erro: o app segue em memória.
   - Dados de uma versão futura (v > 1) são lidos, mas nunca regravados, para não destruir o progresso. */

export const CHAVE = 'violao-descomplicado-progresso';
export const VERSAO = 1;

const RE_AULA = /^m(0[1-9]|10)-a(0[1-9]|[1-9]\d)$/; // m01..m10 + a01..a99
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86400000;

const padrao = () => ({ v: VERSAO, aulas: {}, dias: {}, inicio: null, ultima: null });
const ehObjeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);

/* ---------- validadores (puros) ---------- */

export const idAulaValido = id => typeof id === 'string' && RE_AULA.test(id);

/** Aceita 1..30 como número inteiro ou texto "12". Devolve o número ou null. */
export function normalizarDia(d) {
  const n = typeof d === 'string' && /^\d{1,2}$/.test(d) ? Number(d) : d;
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
}

/** Data AAAA-MM-DD que realmente existe no calendário (rejeita 2026-02-30). */
export function dataValida(s) {
  const m = typeof s === 'string' && RE_DATA.exec(s);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (a < 2020 || a > 2100) return false;
  const t = new Date(Date.UTC(a, me - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === me - 1 && t.getUTCDate() === d;
}

/** Data local do aparelho (não usa toISOString, que viraria o dia à noite por causa do fuso). */
export function hojeLocal(agora = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/** Limpa um objeto qualquer e devolve um estado válido, descartando só o que estiver errado. */
export function validar(bruto) {
  const e = padrao();
  if (!ehObjeto(bruto)) return e;
  if (ehObjeto(bruto.aulas))
    for (const id of Object.keys(bruto.aulas))
      if (idAulaValido(id) && dataValida(bruto.aulas[id])) e.aulas[id] = bruto.aulas[id];
  if (ehObjeto(bruto.dias))
    for (const k of Object.keys(bruto.dias)) {
      const n = normalizarDia(k);
      if (n !== null && String(n) === k && dataValida(bruto.dias[k])) e.dias[k] = bruto.dias[k];
    }
  if (dataValida(bruto.inicio)) e.inicio = bruto.inicio;
  if (idAulaValido(bruto.ultima)) e.ultima = bruto.ultima;
  return e;
}

/* ---------- store ---------- */

/** `storage` e `hoje` podem ser injetados (usado nos testes). Sem storage disponível, funciona só em memória. */
export function criarStore({ storage, hoje = hojeLocal, chave = CHAVE } = {}) {
  let estado = padrao();
  let somenteLeitura = false;   // dados gravados por uma versão mais nova do app
  let persistente = true;       // false depois de qualquer falha de leitura/gravação
  let carregado = false;

  const obterStorage = () => {
    try { return storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null); }
    catch (e) { return null; }  // acessar localStorage pode lançar SecurityError
  };
  const copia = () => JSON.parse(JSON.stringify(estado));
  const limiteFuturo = () => { // tolera 1 dia à frente (fuso horário), rejeita datas futuras além disso
    const [a, m, d] = hoje().split('-').map(Number);
    const t = new Date(Date.UTC(a, m - 1, d) + MS_DIA);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  };
  const dataOk = d => dataValida(d) && d <= limiteFuturo();

  function carregar() {
    carregado = true; somenteLeitura = false; persistente = true;
    const st = obterStorage();
    let texto = null;
    try { texto = st ? st.getItem(chave) : null; if (!st) persistente = false; }
    catch (e) { persistente = false; }
    if (texto == null) { estado = padrao(); return copia(); }
    let bruto;
    try { bruto = JSON.parse(texto); }
    catch (e) { // JSON quebrado: guarda uma cópia do original antes de qualquer regravação
      try { st.setItem(chave + '-corrompido', texto); } catch (e2) {}
      estado = padrao(); return copia();
    }
    if (ehObjeto(bruto) && Number.isInteger(bruto.v) && bruto.v > VERSAO) somenteLeitura = true;
    estado = validar(bruto);   // v ausente/antiga: aproveita os campos reconhecidos (migração)
    return copia();
  }

  function salvar() {
    if (!carregado) carregar();
    if (somenteLeitura) return { ok: false, persistido: false, erro: 'somente-leitura' };
    const st = obterStorage();
    try {
      if (!st) throw new Error('sem-storage');
      st.setItem(chave, JSON.stringify(estado));
      persistente = true;
      return { ok: true, persistido: true };
    } catch (e) { // bloqueado, cheio, modo privado...: o estado em memória continua valendo
      persistente = false;
      return { ok: true, persistido: false, erro: 'armazenamento' };
    }
  }

  const recusa = erro => ({ ok: false, persistido: false, erro });
  const pronto = () => { if (!carregado) carregar(); };

  return {
    carregar,
    salvar,
    estado: () => { pronto(); return copia(); },
    /** Marca a aula como concluída. Se já estava, mantém a data original. */
    concluirAula(id, data = hoje()) {
      pronto();
      if (!idAulaValido(id)) return recusa('id-invalido');
      if (!dataOk(data)) return recusa('data-invalida');
      if (somenteLeitura) return recusa('somente-leitura');
      if (!estado.aulas[id]) estado.aulas[id] = data;
      return salvar();
    },
    desmarcarAula(id) {
      pronto();
      if (!idAulaValido(id)) return recusa('id-invalido');
      if (somenteLeitura) return recusa('somente-leitura');
      delete estado.aulas[id];
      return salvar();
    },
    concluirDia(dia, data = hoje()) {
      pronto();
      const n = normalizarDia(dia);
      if (n === null) return recusa('dia-invalido');
      if (!dataOk(data)) return recusa('data-invalida');
      if (somenteLeitura) return recusa('somente-leitura');
      if (!estado.dias[n]) estado.dias[n] = data;
      return salvar();
    },
    desmarcarDia(dia) {
      pronto();
      const n = normalizarDia(dia);
      if (n === null) return recusa('dia-invalido');
      if (somenteLeitura) return recusa('somente-leitura');
      delete estado.dias[n];
      return salvar();
    },
    /** Registra o início da jornada. Não sobrescreve um início já existente. */
    registrarInicio(data = hoje()) {
      pronto();
      if (!dataOk(data)) return recusa('data-invalida');
      if (somenteLeitura) return recusa('somente-leitura');
      if (estado.inicio) return { ok: true, persistido: persistente, jaRegistrado: true };
      estado.inicio = data;
      return salvar();
    },
    /** Guarda a última aula aberta. Não conclui a aula. */
    atualizarUltima(id) {
      pronto();
      if (!idAulaValido(id)) return recusa('id-invalido');
      if (somenteLeitura) return recusa('somente-leitura');
      estado.ultima = id;
      return salvar();
    },
    aulaConcluida: id => { pronto(); return idAulaValido(id) && !!estado.aulas[id]; },
    diaConcluido: dia => { pronto(); const n = normalizarDia(dia); return n !== null && !!estado.dias[n]; },
    /** false se o progresso não está sendo gravado no aparelho (aviso para o aluno). */
    get persistente() { return persistente; },
    get somenteLeitura() { return somenteLeitura; }
  };
}

/** Instância pronta para uso nas telas: import { store } from './store.js' */
export const store = criarStore();
