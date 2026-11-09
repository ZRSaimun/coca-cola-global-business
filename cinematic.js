/* Scroll-driven film of the value chain.
   Six chapters x eight frames. Scroll position is eased (so wheel notches and
   trackpad flicks both feel like a playhead, not jumps), neighbouring frames are
   dissolved together, and a slow camera pan/push follows the action through each
   wide shot. Chapter text and the illustrated list come from #journeySteps, which
   is also what visitors see without JavaScript or with reduced motion. */
(() => {
  const root = document.documentElement;
  root.classList.add('motion-ready');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = s => document.querySelector(s);
  const track = $('#journeyScroll');
  const list = $('#journeySteps');
  const canvas = $('#journeyCanvas');
  const screen = $('.journey-screen');
  const content = $('.journey-content');
  const stageLabel = $('#journeyStage');
  const titleEl = $('#journeyTitle');
  const captionEl = $('#journeyCaption');
  const actorEl = $('#journeyActor');
  const meter = $('#journeyMeter');
  const progress = $('#journeyProgress');
  const ticks = $('#journeyTicks');
  const prevBtn = $('#journeyPrevBtn');
  const nextBtn = $('#journeyNextBtn');

  const PER_CHAPTER = 8;
  const BG = '#0b1015';

  // Where the camera looks (0 = left edge, 1 = right edge of the wide shot), one
  // value per frame, so the framing follows people and bottles across the scene.
  const FOCUS = {
    '01-ingredients': [.20, .21, .30, .44, .62, .66, .58, .46],
    '04-finish': [.31, .31, .32, .33, .47, .58, .62, .78],
    '05-distribution': [.24, .40, .45, .48, .60, .67, .64, .60],
    '06-customer': [.40, .44, .47, .49, .50, .40, .44, .40]
  };

  const chapters = list ? [...list.querySelectorAll('li')].map(li => ({
    id: li.dataset.chapter,
    wide: li.dataset.kind === 'wide',
    label: li.querySelector('.step-no').textContent.trim().replace(/^\d+\s*·\s*/, ''),
    titleHTML: li.querySelector('h3').innerHTML,
    captionHTML: li.querySelector('p').innerHTML,
    actor: li.dataset.actor || ''
  })) : [];

  const frames = chapters.flatMap((c, ci) => Array.from({ length: PER_CHAPTER }, (_, i) => ({
    chapter: ci,
    wide: c.wide,
    fx: c.wide ? (FOCUS[c.id] || [])[i] ?? .5 : .5,
    src: `assets/bottle-journey/film/${c.id}-${String(i + 1).padStart(2, '0')}.webp`,
    img: null
  })));
  const LAST = frames.length - 1;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

  const ctx = canvas && canvas.getContext('2d', { alpha: false });
  let enabled = false, raf = 0, lastTime = 0;
  let shown = 0, target = 0, activeChapter = -1, W = 0, H = 0, dpr = 1, painted = '';

  // ---------- loading: current chapter first, then the rest in story order ----------
  function load(i) {
    const f = frames[i];
    if (!f || f.img) return;
    f.img = new Image();
    f.img.decoding = 'async';
    f.img.onload = () => { painted = ''; request(); };
    f.img.src = f.src;
  }
  function loadAround(i) {
    const c = Math.floor(i / PER_CHAPTER);
    for (let k = c * PER_CHAPTER; k < (c + 2) * PER_CHAPTER; k++) load(k);
  }
  const ready = i => frames[i] && frames[i].img && frames[i].img.complete && frames[i].img.naturalWidth > 0;
  function nearestReady(i) {
    for (let d = 0; d <= LAST; d++) {
      if (ready(i - d)) return i - d;
      if (ready(i + d)) return i + d;
    }
    return -1;
  }

  // ---------- drawing ----------
  function resize() {
    if (!ctx) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, screen.clientWidth);
    H = Math.max(1, screen.clientHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    painted = '';
  }

  // Frame composition prioritizes the full source image on every viewport.
  function drawFrame(i, alpha) {
    const f = frames[i], img = f.img;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    const x = (W - dw) / 2, y = (H - dh) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, dw, dh);
    ctx.globalAlpha = 1;
  }

  function render(pos) {
    const i = clamp(Math.floor(pos), 0, LAST);
    const j = Math.min(LAST, i + 1);
    const t = pos - i;
    const key = pos.toFixed(4) + W + 'x' + H;
    if (key === painted) return;

    const a = nearestReady(i);
    if (a < 0) return;
    const b = ready(j) ? j : a;

    // Dissolve: each frame holds briefly, then blends into the next.
    const mix = b === a ? 0 : smooth(.22, .78, t);
    // Camera: focus point eases continuously between frames; a gentle push-in
    // runs across each chapter so the picture never sits still.
    const fx = lerp(frames[a].fx, frames[b].fx, smooth(0, 1, t));
    const chapterT = (pos % PER_CHAPTER) / PER_CHAPTER;
    const push = 1.02 + .06 * chapterT;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawFrame(a, 1, fx, push);
    if (mix > 0) drawFrame(b, mix, fx, frames[b].chapter === frames[a].chapter ? push : 1.02);

    // Soft vignette so the scene reads as one continuous shot.
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    v.addColorStop(0, 'rgba(11,16,21,0)');
    v.addColorStop(1, 'rgba(11,16,21,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    painted = key;
  }

  // ---------- chapter text ----------
  function setChapter(c) {
    if (c === activeChapter || !chapters[c]) return;
    activeChapter = c;
    const ch = chapters[c];
    stageLabel.textContent = `${String(c + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')} · ${ch.label}`;
    titleEl.innerHTML = ch.titleHTML;
    captionEl.innerHTML = ch.captionHTML;
    actorEl.innerHTML = ch.actor ? 'Who adds value here: <b>' + ch.actor + '</b>' : '';
    content.classList.remove('is-entering'); void content.offsetWidth; content.classList.add('is-entering');
    progress.setAttribute('aria-valuenow', String(c + 1));
    progress.setAttribute('aria-valuetext', `Chapter ${c + 1} of ${chapters.length}: ${ch.label.toLowerCase()}`);
    ticks.querySelectorAll('button').forEach((b, k) => k === c ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'));
    prevBtn.disabled = c === 0;
    nextBtn.disabled = c === chapters.length - 1;
    loadAround(c * PER_CHAPTER);
  }

  // ---------- scroll -> eased playhead ----------
  function scrollTarget() {
    const rect = track.getBoundingClientRect();
    const amount = Math.max(1, track.offsetHeight - window.innerHeight);
    const f = clamp(-rect.top / amount, 0, 1);
    return { f, rect, amount };
  }

  function tick(now) {
    raf = 0;
    if (!enabled) return;
    const dt = Math.min(64, now - (lastTime || now));
    lastTime = now;
    const { f } = scrollTarget();
    target = f * LAST;
    // Exponential easing toward the scroll position (~180 ms time constant).
    const k = 1 - Math.exp(-dt / 180);
    shown += (target - shown) * k;
    if (Math.abs(target - shown) < .002) shown = target;
    render(shown);
    meter.style.transform = `scaleX(${(shown / LAST).toFixed(4)})`;
    setChapter(clamp(Math.floor((shown + .5) / PER_CHAPTER), 0, chapters.length - 1));
    if (shown !== target) request(); else lastTime = 0;
  }
  function request() { if (!raf && enabled) raf = requestAnimationFrame(tick); }

  function goToChapter(c) {
    c = clamp(c, 0, chapters.length - 1);
    loadAround(c * PER_CHAPTER);
    const { rect, amount } = scrollTarget();
    const frac = (c * PER_CHAPTER + .5) / LAST;
    window.scrollTo({ top: window.scrollY + rect.top + amount * frac, behavior: 'smooth' });
  }

  function buildTicks() {
    chapters.forEach((ch, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.left = `${(k * PER_CHAPTER / LAST) * 100}%`;
      b.setAttribute('aria-label', `Chapter ${k + 1}: ${ch.label.toLowerCase()}`);
      b.title = ch.label.charAt(0) + ch.label.slice(1).toLowerCase();
      b.addEventListener('click', () => goToChapter(k));
      ticks.appendChild(b);
    });
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    root.classList.add('journey-enhanced');
    resize();
    const { f } = scrollTarget();
    shown = target = f * LAST;
    loadAround(Math.floor(shown));
    request();
  }
  function disable() {
    enabled = false;
    root.classList.remove('journey-enhanced');
  }

  if (track && list && canvas && ctx && chapters.length) {
    buildTicks();
    prevBtn.addEventListener('click', () => goToChapter(activeChapter - 1));
    nextBtn.addEventListener('click', () => goToChapter(activeChapter + 1));
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', () => { if (enabled) { resize(); request(); } }, { passive: true });
    // Start loading the film once the visitor gets near it, then the rest quietly.
    const warm = () => { loadAround(0); setTimeout(() => frames.forEach((_, i) => load(i)), 1200); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { warm(); io.disconnect(); } }, { rootMargin: '150% 0px' });
      io.observe(track);
    } else warm();
    const sync = () => (reduceMotion.matches ? disable() : enable());
    reduceMotion.addEventListener ? reduceMotion.addEventListener('change', sync) : reduceMotion.addListener(sync);
    sync();
  }

  // ---------- gentle reveals elsewhere on the page ----------
  function revealSections() {
    const items = document.querySelectorAll('.journey-intro,.poster-section,.framework .section-heading,.evidence-key,.lens-card,.network,.conclusion,.sources');
    if (!('IntersectionObserver' in window)) return;
    items.forEach(item => item.classList.add('reveal-on-scroll'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    items.forEach(item => observer.observe(item));
  }
  revealSections();
})();
