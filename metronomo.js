/* Metrônomo — Web Audio API com agendamento antecipado (lookahead).
   Os cliques são agendados no relógio do áudio (ctx.currentTime), que é preciso;
   o timer só "acorda" a cada 25 ms para agendar as próximas batidas (até 120 ms à frente). */
(() => {
  const $ = id => document.getElementById(id);
  const MIN = 40, MAX = 240, LOOKAHEAD = 0.12, TICK_MS = 25;
  let bpm = 100, beats = 4, running = false;
  let ctx = null, timer = null, nextTime = 0, beatIdx = 0, queue = [], lastShown = -1, wake = null;

  try { const s = JSON.parse(localStorage.getItem('vd-metro') || '{}');
    if (s.bpm >= MIN && s.bpm <= MAX) bpm = s.bpm; if ([2, 3, 4].includes(s.beats)) beats = s.beats; } catch (e) {}
  const save = () => { try { localStorage.setItem('vd-metro', JSON.stringify({ bpm, beats })); } catch (e) {} };

  // Timer em Web Worker (não é reduzido em segundo plano); se falhar, usa setTimeout.
  function startTimer() {
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),' + TICK_MS + ')'], { type: 'text/javascript' }));
      timer = new Worker(url); timer.onmessage = schedule; timer._url = url;
    } catch (e) { timer = { fb: setInterval(schedule, TICK_MS) }; }
  }
  function stopTimer() {
    if (!timer) return;
    if (timer.fb) clearInterval(timer.fb); else { timer.terminate(); URL.revokeObjectURL(timer._url); }
    timer = null;
  }

  function click(time, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1600 : 1000;
    const v = accent ? 1 : 0.65;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(v, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    o.connect(g).connect(ctx.destination);
    o.start(time); o.stop(time + 0.09);
  }

  function schedule() {
    if (!running) return;
    if (nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.05; // voltou de pausa do sistema: ressincroniza
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      click(nextTime, beatIdx === 0);
      queue.push({ t: nextTime, i: beatIdx });
      nextTime += 60 / bpm;              // usa o BPM atual: mudanças valem na próxima batida, sem parar
      beatIdx = (beatIdx + 1) % beats;
    }
  }

  // Indicador visual: acende quando o relógio do áudio alcança o instante de cada batida.
  function draw() {
    if (!running) return;
    const lat = ctx.outputLatency || ctx.baseLatency || 0, now = ctx.currentTime - lat;
    while (queue.length && queue[0].t <= now) show(queue.shift().i);
    requestAnimationFrame(draw);
  }
  function show(i) {
    const d = $('beats').children;
    if (lastShown >= 0 && d[lastShown]) d[lastShown].classList.remove('on');
    if (d[i]) d[i].classList.add('on'); lastShown = i;
  }

  async function start() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    running = true; beatIdx = 0; queue = []; nextTime = ctx.currentTime + 0.08;
    schedule(); startTimer(); requestAnimationFrame(draw);
    $('play').textContent = 'Pausar'; $('play').setAttribute('aria-pressed', 'true');
    try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} // tela acesa enquanto toca
  }
  function stop() {
    running = false; stopTimer(); queue = [];
    if (lastShown >= 0) $('beats').children[lastShown]?.classList.remove('on'); lastShown = -1;
    $('play').textContent = 'Iniciar'; $('play').setAttribute('aria-pressed', 'false');
    try { wake && wake.release(); } catch (e) {} wake = null;
  }

  function nameFor(b) {
    return b < 60 ? 'Muito lento' : b < 76 ? 'Lento' : b < 108 ? 'Moderado' : b < 132 ? 'Animado' : b < 168 ? 'Rápido' : 'Muito rápido';
  }
  function setBpm(v) {
    bpm = Math.max(MIN, Math.min(MAX, Math.round(v)));
    $('bpmNum').textContent = bpm; $('slider').value = bpm; $('tempoName').textContent = nameFor(bpm);
    $('slider').setAttribute('aria-valuetext', bpm + ' batidas por minuto');
    document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.bpm === bpm));
    save();
  }
  function setBeats(n) {
    beats = n; beatIdx = 0;
    $('beats').innerHTML = '<i></i>'.repeat(n); lastShown = -1; queue = [];
    document.querySelectorAll('#compasso button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.beats === n));
    save();
  }

  // Botões −/+ : toque = 1 BPM; segurar repete e acelera.
  function hold(btn, step) {
    let t1, t2;
    const go = () => setBpm(bpm + step);
    const end = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); go(); t1 = setTimeout(() => { t2 = setInterval(go, 70); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, end));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  hold($('menos'), -1); hold($('mais'), 1);
  $('slider').addEventListener('input', e => setBpm(+e.target.value));
  document.querySelectorAll('#presets button').forEach(b => b.onclick = () => setBpm(+b.dataset.bpm));
  document.querySelectorAll('#compasso button').forEach(b => b.onclick = () => setBeats(+b.dataset.beats));
  $('play').onclick = () => running ? stop() : start();
  addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('play').click(); } });
  document.addEventListener('visibilitychange', async () => { // reativa a tela acesa ao voltar
    if (!document.hidden && running) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  });

  setBeats(beats); setBpm(bpm);
})();
