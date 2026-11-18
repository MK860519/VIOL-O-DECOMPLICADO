/* Diagrama de acorde em SVG, gerado a partir dos dados da aula (sem imagens). */
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, texto) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (texto != null) e.textContent = texto;
  return e;
};

/** cordas: 6 valores (6ª→1ª): -1 não tocar, 0 solta, N casa. dedos: 6 valores (0 = nenhum). */
export function diagramaAcorde({ nome, cordas, dedos }) {
  const X = i => 20 + i * 16, Y = j => 34 + j * 20, FR = 5;
  const pos = cordas.filter(c => c > 0);
  const min = pos.length ? Math.min(...pos) : 1, max = pos.length ? Math.max(...pos) : 1;
  const base = max > FR ? min : 1;
  const svg = s('svg', { viewBox: '0 0 120 150', role: 'img', 'aria-label': `Diagrama do acorde ${nome}`, class: 'acorde' });
  for (let j = 0; j <= FR; j++) svg.append(s('line', { x1: X(0), x2: X(5), y1: Y(j), y2: Y(j), class: j === 0 && base === 1 ? 'pestana-topo' : 'traste' }));
  for (let i = 0; i < 6; i++) svg.append(s('line', { x1: X(i), x2: X(i), y1: Y(0), y2: Y(FR), class: 'corda' }));
  if (base > 1) svg.append(s('text', { x: X(5) + 6, y: Y(0) + 14, class: 'casa' }, `${base}ª`));
  cordas.forEach((c, i) => {
    if (c === -1) svg.append(s('text', { x: X(i), y: 24, class: 'x' }, '×'));
    else if (c === 0) svg.append(s('circle', { cx: X(i), cy: 20, r: 4.5, class: 'marca' }));
  });
  const linhaDe = c => Y(c - base) + 10;
  const barra = cordas.map((c, i) => (c === min && dedos[i] === 1 ? i : -1)).filter(i => i >= 0);
  const temBarra = barra.length >= 2;
  if (temBarra) {
    const a = barra[0], b = barra[barra.length - 1];
    svg.append(s('rect', { x: X(a) - 8, y: linhaDe(min) - 8, width: X(b) - X(a) + 16, height: 16, rx: 8, class: 'barra' }));
    svg.append(s('text', { x: X(a), y: linhaDe(min) + 4, class: 'num' }, '1'));
  }
  cordas.forEach((c, i) => {
    if (c <= 0 || (temBarra && c === min && dedos[i] === 1)) return;
    svg.append(s('circle', { cx: X(i), cy: linhaDe(c), r: 8, class: 'dedo' }));
    svg.append(s('text', { x: X(i), y: linhaDe(c) + 4, class: 'num' }, String(dedos[i])));
  });
  return svg;
}
