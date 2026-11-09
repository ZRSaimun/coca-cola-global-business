/* Scroll-scrubbed illustrated journey. Each chapter is an eight-frame storyboard;
   the canvas selects a single real frame at a time instead of moving/crossfading photos. */
(() => {
  const root = document.documentElement;
  root.classList.add('motion-ready');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = document.querySelector('#journeyScroll');
  const list = document.querySelector('#journeySteps');
  const canvas = document.querySelector('#journeyFrameCanvas');
  const photo = document.querySelector('.journey-photo');
  const content = document.querySelector('.journey-content');
  const stageLabel = document.querySelector('#journeyStage');
  const titleEl = document.querySelector('#journeyTitle');
  const captionEl = document.querySelector('#journeyCaption');
  const actorEl = document.querySelector('#journeyActor');
  const meter = document.querySelector('#journeyMeter');
  const progress = document.querySelector('#journeyProgress');
  const prevBtn = document.querySelector('#journeyPrevBtn');
  const nextBtn = document.querySelector('#journeyNextBtn');
  const FRAME_COUNT = 8;

  const stages = list ? [...list.querySelectorAll('li')].map(li => ({
    sequence: li.dataset.sequence,
    label: li.querySelector('.step-no').textContent.trim(),
    titleHTML: li.querySelector('h3').innerHTML,
    captionHTML: li.querySelector('p').innerHTML,
    actor: li.dataset.actor || ''
  })) : [];
  const frames = stages.flatMap(s => Array.from({length: FRAME_COUNT}, (_, i) =>
    `assets/bottle-journey/sequence/${s.sequence}-${String(i + 1).padStart(2, '0')}.webp`));
  const pictures = frames.map(src => { const img = new Image(); img.src = src; return img; });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);
  let enabled = false, raf = 0, activeStage = -1, paintedFrame = '', canvasWidth = 0, canvasHeight = 0, shownFraction = 0, targetFraction = 0;
  const ctx = canvas?.getContext('2d', {alpha:false, desynchronized:true});

  function scrollRange() {
    const rect = track.getBoundingClientRect();
    const amount = Math.max(1, track.offsetHeight - window.innerHeight);
    return {rect, amount, fraction:clamp(-rect.top / amount, 0, 1)};
  }

  function setCanvasSize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, photo.clientWidth), h = Math.max(1, photo.clientHeight);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasWidth = w; canvasHeight = h; paintedFrame = -1;
  }

  function drawCover(img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawContained(img, alpha = 1) {
    const w = canvasWidth, h = canvasHeight;
    const mobile = w <= 780;
    const maxW = mobile ? w * .96 : w * .70;
    const maxH = mobile ? h * (h < 680 ? .45 : .54) : h * .90;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const x = mobile ? (w - dw) / 2 : clamp(w * .67 - dw / 2, w * .29, w - dw);
    const y = mobile ? Math.max(12, h * .035) : (h - dh) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, dw, dh);
    ctx.globalAlpha = 1;
  }

  function paintFrame(position) {
    if (!ctx || !pictures.length) return;
    const lower = clamp(Math.floor(position), 0, pictures.length - 1);
    const upper = Math.min(pictures.length - 1, lower + 1);
    const mix = position - lower;
    const first = pictures[lower]?.complete && pictures[lower].naturalWidth ? pictures[lower] : null;
    const second = pictures[upper]?.complete && pictures[upper].naturalWidth ? pictures[upper] : null;
    if (!first && !second) return;
    const signature = `${lower}:${upper}:${mix.toFixed(3)}`;
    if (signature === paintedFrame) return;
    const base = first || second;
    const w = canvasWidth, h = canvasHeight;
    ctx.fillStyle = '#080d11';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.filter = 'blur(28px) brightness(.42) saturate(.8)';
    drawCover(base, -32, -32, w + 64, h + 64);
    ctx.restore();
    drawContained(base, second && first ? 1 - mix : 1);
    if (second && first && upper !== lower) drawContained(second, mix);
    else if (second && !first) drawContained(second, 1);
    paintedFrame = signature;
  }

  function setStage(index) {
    if (index === activeStage || !stages[index]) return;
    activeStage = index;
    const s = stages[index];
    stageLabel.textContent = `${String(index + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')} · ${s.label.replace(/^\d+\s*·\s*/, '')}`;
    titleEl.innerHTML = s.titleHTML;
    captionEl.innerHTML = s.captionHTML;
    actorEl.innerHTML = s.actor ? 'Who adds value here: <b>' + s.actor + '</b>' : '';
    content.classList.remove('is-entering'); void content.offsetWidth; content.classList.add('is-entering');
    progress.setAttribute('aria-valuenow', String(index + 1));
    progress.setAttribute('aria-valuetext', `Stage ${index + 1} of ${stages.length}: ${s.label.replace(/^\d+\s*·\s*/, '')}`);
    prevBtn.disabled = index === 0; nextBtn.disabled = index === stages.length - 1;
  }

  function paint() {
    raf = 0;
    if (!enabled) return;
    targetFraction = scrollRange().fraction;
    shownFraction += (targetFraction - shownFraction) * .24;
    if (Math.abs(targetFraction - shownFraction) < .0008) shownFraction = targetFraction;
    const position = shownFraction * (frames.length - 1);
    const stage = Math.min(stages.length - 1, Math.floor(position / FRAME_COUNT));
    paintFrame(position);
    meter.style.transform = `scaleX(${targetFraction.toFixed(4)})`;
    setStage(stage);
    if (shownFraction !== targetFraction) requestPaint();
  }
  const requestPaint = () => { if (!raf) raf = requestAnimationFrame(paint); };

  function goToStage(index) {
    index = clamp(index, 0, stages.length - 1);
    const {rect, amount} = scrollRange();
    const fraction = (index * FRAME_COUNT) / Math.max(1, frames.length - 1);
    window.scrollTo({top:window.scrollY + rect.top + amount * fraction + 2, behavior:'smooth'});
  }

  function enable() {
    if (enabled) return;
    enabled = true; root.classList.add('journey-enhanced'); setCanvasSize(); shownFraction = targetFraction = scrollRange().fraction; requestPaint();
  }
  function disable() {
    enabled = false; root.classList.remove('journey-enhanced');
  }

  if (track && list && canvas && ctx && stages.length) {
    prevBtn.addEventListener('click', () => goToStage(activeStage - 1));
    nextBtn.addEventListener('click', () => goToStage(activeStage + 1));
    window.addEventListener('scroll', requestPaint, {passive:true});
    window.addEventListener('resize', () => { setCanvasSize(); requestPaint(); }, {passive:true});
    pictures.forEach(img => img.addEventListener('load', requestPaint, {once:true}));
    const sync = () => (reduceMotion.matches ? disable() : enable());
    reduceMotion.addEventListener ? reduceMotion.addEventListener('change', sync) : reduceMotion.addListener(sync);
    sync();
  }

  function revealSections() {
    const items = document.querySelectorAll('.journey-intro,.poster-section,.framework .section-heading,.evidence-key,.lens-card,.network,.conclusion,.sources');
    if (!('IntersectionObserver' in window)) return;
    items.forEach(item => item.classList.add('reveal-on-scroll'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), {threshold:.08, rootMargin:'0px 0px -4% 0px'});
    items.forEach(item => observer.observe(item));
  }
  revealSections();
})();
