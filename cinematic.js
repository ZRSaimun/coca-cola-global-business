(() => {
  document.documentElement.classList.add('motion-ready');
  const stages = [
    {name:'INPUTS', title:'It begins with the materials.', caption:'Raw ingredients and glassmaking inputs enter a worldwide supply chain.'},
    {name:'BOTTLE FORMING', title:'The glass takes shape.', caption:'Molten glass is formed into the familiar contour bottle.'},
    {name:'INSPECTION', title:'Every empty bottle is checked.', caption:'Bottles are washed and inspected before filling.'},
    {name:'BEVERAGE PREPARATION', title:'The drink is prepared locally.', caption:'Water, concentrate and other ingredients are blended at the bottling stage.'},
    {name:'FILLING · START', title:'The pour begins.', caption:'A measured stream of cola enters the empty glass bottle.'},
    {name:'FILLING · CONTINUES', title:'The level rises.', caption:'The same filling process continues as the bottle moves along the line.'},
    {name:'FILLING · COMPLETE', title:'The bottle is nearly full.', caption:'The fill reaches its target before the bottle moves to finishing.'},
    {name:'FINISHING & PACKING', title:'Caps and labels are added.', caption:'Finished bottles move into reusable crates and other packaging.'},
    {name:'LOCAL DISTRIBUTION', title:'A local partner serves the shop.', caption:'Bottling and delivery connect the wider brand with a local retailer.'},
    {name:'CUSTOMER', title:'The product reaches the customer.', caption:'The journey ends in a local market, where people choose and enjoy the product.'}
  ];
  const scrollTrack = document.querySelector('#journeyScroll');
  const imageA = document.querySelector('#journeyCurrent');
  const imageB = document.querySelector('#journeyNext');
  const stageLabel = document.querySelector('#journeyStage');
  const stageTitle = document.querySelector('#journey-title');
  const stageCaption = document.querySelector('#journeyCaption');
  const counter = document.querySelector('#journeyCounter');
  const meter = document.querySelector('#journeyMeter');
  const progress = document.querySelector('.journey-meter[role="progressbar"]');
  let raf = 0;
  let lastStage = -1;
  let lastFramePair = '';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function framePath(index) { return 'assets/bottle-journey/frame-' + String(index + 1).padStart(2, '0') + '.webp'; }
  function scrollAmount() { return Math.max(1, scrollTrack.offsetHeight - window.innerHeight); }

  function paint() {
    raf = 0;
    if (!scrollTrack) return;
    const rect = scrollTrack.getBoundingClientRect();
    const amount = scrollAmount();
    const fraction = clamp(-rect.top / amount, 0, 1);
    const position = fraction * (stages.length - 1);
    const first = Math.floor(position);
    const second = Math.min(stages.length - 1, first + 1);
    const blend = position - first;
    const pair = first + ':' + second;
    if (pair !== lastFramePair) {
      imageA.src = framePath(first);
      imageB.src = framePath(second);
      lastFramePair = pair;
    }
    imageB.style.opacity = second === first ? '0' : String(blend);
    const active = Math.min(stages.length - 1, Math.floor(position + 0.001));
    if (active !== lastStage) {
      const stage = stages[active];
      stageLabel.textContent = String(active + 1).padStart(2, '0') + ' / 10 · ' + stage.name;
      stageTitle.textContent = stage.title;
      stageCaption.textContent = stage.caption;
      counter.innerHTML = String(active + 1).padStart(2, '0') + ' <span>/</span> 10';
      progress.setAttribute('aria-valuenow', String(active + 1));
      progress.setAttribute('aria-valuetext', stage.name + ', stage ' + (active + 1) + ' of 10');
      lastStage = active;
    }
    meter.style.width = (fraction * 100) + '%';
  }

  function requestPaint() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function jumpToStage(delta) {
    const rect = scrollTrack.getBoundingClientRect();
    const amount = scrollAmount();
    const current = clamp(Math.round((-rect.top / amount) * (stages.length - 1)), 0, stages.length - 1);
    const next = clamp(current + delta, 0, stages.length - 1);
    const top = window.scrollY + rect.top + amount * (next / (stages.length - 1));
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  if (scrollTrack && imageA && imageB) {
    stages.forEach((_, index) => { const image = new Image(); image.src = framePath(index); });
    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', requestPaint, { passive: true });
    document.querySelector('#journeyPrev').addEventListener('click', () => jumpToStage(-1));
    document.querySelector('#journeyNext').addEventListener('click', () => jumpToStage(1));
    requestPaint();
  }

  function revealSections() {
    const items = document.querySelectorAll('.poster-section,.framework,.lens-card,.network,.conclusion,.sources');
    items.forEach(item => item.classList.add('reveal-on-scroll'));
    if (!('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'));
      return;
    }
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
