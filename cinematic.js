/* Cinematic polish: a scroll-driven value-chain journey and gentle section reveals.
   The journey reads its stages from the static <ol id="journeySteps"> list, which is
   what visitors see without JavaScript or with reduced motion. */
(() => {
  const root = document.documentElement;
  root.classList.add('motion-ready');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = document.querySelector('#journeyScroll');
  const list = document.querySelector('#journeySteps');
  const layerA = document.querySelector('#journeyLayerA');
  const layerB = document.querySelector('#journeyLayerB');
  const photo = document.querySelector('.journey-photo');
  const content = document.querySelector('.journey-content');
  const stageLabel = document.querySelector('#journeyStage');
  const titleEl = document.querySelector('#journeyTitle');
  const captionEl = document.querySelector('#journeyCaption');
  const actorEl = document.querySelector('#journeyActor');
  const meter = document.querySelector('#journeyMeter');
  const progress = document.querySelector('#journeyProgress');
  const rail = document.querySelector('#journeyRail');
  const prevBtn = document.querySelector('#journeyPrevBtn');
  const nextBtn = document.querySelector('#journeyNextBtn');

  const ASPECT = 1023 / 576;
  const framePath = id => 'assets/bottle-journey/frame-' + id + '.webp';

  // Camera keyframes in story order. fx = horizontal point of the picture to keep in view,
  // s = zoom. Two keyframes in one stage (filling) show the level rising; two stages on one
  // frame (distribution -> retail) become a pan instead of a cut.
  const keyframes = [
    { stage: 0, frame: '01', fx: .46, s: 1.06 },
    { stage: 1, frame: '02', fx: .62, s: 1.10 },
    { stage: 2, frame: '05', fx: .62, s: 1.08 },
    { stage: 2, frame: '07', fx: .61, s: 1.14 },
    { stage: 3, frame: '06', fx: .58, s: 1.28 },
    { stage: 4, frame: '09', fx: .33, s: 1.12 },
    { stage: 5, frame: '09', fx: .80, s: 1.16 },
    { stage: 6, frame: '10', fx: .56, s: 1.05 }
  ];

  const stages = list ? [...list.querySelectorAll('li')].map(li => ({
    label: li.querySelector('.step-no').textContent.trim(),
    titleHTML: li.querySelector('h3').innerHTML,
    captionHTML: li.querySelector('p').innerHTML,
    actor: li.dataset.actor || ''
  })) : [];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const smoothstep = (a, b, t) => ease(clamp((t - a) / (b - a), 0, 1));

  let enabled = false;
  let raf = 0;
  let pair = '';
  let activeStage = -1;
  const firstKeyOfStage = stage => keyframes.findIndex(k => k.stage === stage);

  function place(img, pose) {
    const W = photo.clientWidth;
    const H = photo.clientHeight;
    const baseW = Math.max(W, H * ASPECT);
    const baseH = baseW / ASPECT;
    const w = baseW * pose.s;
    const h = baseH * pose.s;
    // On wide screens the text sits on the left, so frame the subject right of centre.
    const anchor = W > 820 ? W * .64 : W * .5;
    const tx = clamp(anchor - pose.fx * w, W - w, 0);
    const ty = clamp(H * .5 - .5 * h, H - h, 0);
    img.style.width = baseW + 'px';
    img.style.height = baseH + 'px';
    img.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${pose.s.toFixed(4)})`;
  }

  function scrollRange() {
    const rect = track.getBoundingClientRect();
    const amount = Math.max(1, track.offsetHeight - window.innerHeight);
    return { rect, amount, fraction: clamp(-rect.top / amount, 0, 1) };
  }

  function setStage(index) {
    if (index === activeStage || !stages[index]) return;
    activeStage = index;
    const s = stages[index];
    stageLabel.textContent = s.label.replace(/^(\d+)/, '$1 / ' + String(stages.length).padStart(2, '0'));
    titleEl.innerHTML = s.titleHTML;
    captionEl.innerHTML = s.captionHTML;
    actorEl.innerHTML = s.actor ? 'Who adds value here: <b>' + s.actor + '</b>' : '';
    content.classList.remove('is-entering');
    void content.offsetWidth; // restart the entrance animation
    content.classList.add('is-entering');
    progress.setAttribute('aria-valuenow', String(index + 1));
    progress.setAttribute('aria-valuetext', 'Stage ' + (index + 1) + ' of ' + stages.length + ': ' + s.label.replace(/^\d+\s*·\s*/, ''));
    rail.querySelectorAll('button').forEach((b, i) => {
      if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === stages.length - 1;
  }

  function paint() {
    raf = 0;
    if (!enabled) return;
    const { fraction } = scrollRange();
    const p = fraction * (keyframes.length - 1);
    const i = Math.min(keyframes.length - 2, Math.floor(p));
    const t = clamp(p - i, 0, 1);
    const a = keyframes[i];
    const b = keyframes[i + 1];
    const key = a.frame + b.frame;
    if (key !== pair) {
      if (!layerA.src.endsWith(framePath(a.frame))) layerA.src = framePath(a.frame);
      if (!layerB.src.endsWith(framePath(b.frame))) layerB.src = framePath(b.frame);
      pair = key;
    }
    if (a.frame === b.frame) {
      // Same picture: a continuous camera move.
      const k = ease(t);
      place(layerA, { fx: lerp(a.fx, b.fx, k), s: lerp(a.s, b.s, k) });
      layerB.style.opacity = '0';
    } else {
      // New picture: keep pushing in on the old one while the next settles into place.
      const fade = smoothstep(.32, .82, t);
      place(layerA, { fx: a.fx, s: a.s * (1 + .07 * t) });
      place(layerB, { fx: b.fx, s: b.s * (1 + .05 * (1 - fade)) });
      layerB.style.opacity = fade.toFixed(3);
    }
    meter.style.transform = `scaleX(${fraction.toFixed(4)})`;
    setStage(keyframes[Math.round(p)].stage);
  }

  const requestPaint = () => { if (!raf) raf = requestAnimationFrame(paint); };

  function goToStage(index) {
    index = clamp(index, 0, stages.length - 1);
    const { rect, amount } = scrollRange();
    const k = firstKeyOfStage(index);
    const top = window.scrollY + rect.top + amount * (k / (keyframes.length - 1)) + 2;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function buildRail() {
    stages.forEach((s, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      const name = s.label.replace(/^\d+\s*·\s*/, '');
      button.innerHTML = '<span>' + String(i + 1).padStart(2, '0') + '</span><b>' + name + '</b>';
      button.setAttribute('aria-label', 'Stage ' + (i + 1) + ': ' + name.toLowerCase());
      button.addEventListener('click', () => goToStage(i));
      rail.appendChild(button);
    });
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    root.classList.add('journey-enhanced');
    requestPaint();
  }
  function disable() {
    enabled = false;
    root.classList.remove('journey-enhanced');
  }

  if (track && list && layerA && layerB && stages.length) {
    buildRail();
    // Warm the cache so frame swaps never flash.
    [...new Set(keyframes.map(k => k.frame))].forEach(id => { const img = new Image(); img.src = framePath(id); });
    [layerA, layerB].forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }));
    prevBtn.addEventListener('click', () => goToStage(activeStage - 1));
    nextBtn.addEventListener('click', () => goToStage(activeStage + 1));
    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', () => { pair = ''; requestPaint(); }, { passive: true });
    const sync = () => (reduceMotion.matches ? disable() : enable());
    reduceMotion.addEventListener ? reduceMotion.addEventListener('change', sync) : reduceMotion.addListener(sync);
    sync();
  }

  function revealSections() {
    const items = document.querySelectorAll('.journey-intro,.poster-section,.framework .section-heading,.evidence-key,.lens-card,.network,.conclusion,.sources');
    if (!('IntersectionObserver' in window)) return;
    items.forEach(item => item.classList.add('reveal-on-scroll'));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    items.forEach(item => observer.observe(item));
  }
  revealSections();
})();
