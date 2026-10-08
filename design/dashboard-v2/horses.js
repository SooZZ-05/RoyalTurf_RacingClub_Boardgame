(() => {
  const board = document.querySelector('#board-scene');
  if (!board) return;
  const names = ['白雪公主', '黑色傳說', '赤紅地毯', '湛藍海洋', '金黃猛虎', '綠貝雷帽', '橘子汽水'];
  const colors = ['#f2ece0', '#373a3d', '#da94a7', '#4b94c3', '#e6ba45', '#63a281', '#dc8845'];
  const positions = [0, -1, -2, -3, -4, -5, -6];
  const offsets = positions.map(() => 0);
  const facing = positions.map(() => 1);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selectable = new Set();
  let used = new Set();
  let motion = null;

  const layer = document.createElement('div');
  layer.className = 'horse-pieces';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', '棋盤上的七匹賽馬');
  const pieces = names.map((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'horse-piece';
    button.dataset.piece = String(index);
    button.dataset.horseId = String(index);
    button.dataset.position = String(positions[index]);
    button.style.setProperty('--piece-color', colors[index]);
    // Atlas: four equal columns by two rows; the eighth cell is empty.
    button.style.setProperty('--sprite-x', `${(index % 4) / 3 * 100}%`);
    button.style.setProperty('--sprite-y', index < 4 ? '0%' : '100%');
    button.innerHTML = `<span class="piece-ground" aria-hidden="true"></span><span class="piece-art" aria-hidden="true"></span><span class="piece-number" aria-hidden="true">${index + 1}</span>`;
    button.addEventListener('click', () => {
      if (motion || !selectable.has(index)) return;
      window.dispatchEvent(new CustomEvent('preview-horse-select', { detail: index }));
    });
    layer.append(button);
    return button;
  });
  board.append(layer);

  const wrapped = value => ((value - 1) % 36 + 36) % 36 + 1;
  const blend = (a, b, fraction) => a + (b - a) * fraction;
  function pose(index, position, offset, hop = 0) {
    if (typeof window.previewTrackPoint !== 'function') return;
    const point = window.previewTrackPoint(position);
    const before = window.previewTrackPoint(position - .05);
    const after = window.previewTrackPoint(position + .05);
    const dx = after.x - before.x, dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    if (dx > .08) facing[index] = -1;
    else if (dx < -.08) facing[index] = 1;
    // Stagger a shared-space group across the lane and slightly along it, so
    // successive arrivals do not hide each other's bodies and number badges.
    const stagger = -offset * .85;
    const x = point.x - dy / length * offset + dx / length * stagger;
    const y = point.y + dx / length * offset + dy / length * stagger;
    const button = pieces[index];
    button.style.left = `${x / 1536 * 100}%`;
    button.style.top = `${y / 1024 * 100}%`;
    button.style.zIndex = String(Math.round(y));
    button.style.setProperty('--piece-facing', facing[index]);
    button.style.setProperty('--piece-hop', `${hop / 1536 * 100}cqw`);
    button.style.setProperty('--shadow-scale', String(1 - hop * .035));
    button.style.setProperty('--shadow-opacity', String(.35 - hop * .035));
    button.dataset.progressPosition = String(position);
  }
  function renderPositions() {
    positions.forEach((position, index) => {
      if (motion?.index === index) {
        pose(index, motion.position, motion.offset, motion.hop);
      } else pose(index, position, offsets[index]);
    });
  }
  function renderState() {
    pieces.forEach((button, index) => {
      const ready = selectable.has(index) && !motion;
      button.disabled = !ready;
      button.classList.toggle('selectable', ready);
      button.classList.toggle('used', used.has(index));
      button.classList.toggle('moving', motion?.index === index);
      button.dataset.position = String(positions[index]);
      const status = motion?.index === index ? '前進中' : used.has(index) ? '已行動' : ready ? '可以前進' : '等待擲骰';
      const label = `${index + 1} ${names[index]}，位置 ${positions[index]}，${status}`;
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }
  function sync({ selectable: nextSelectable = [], used: nextUsed = [] } = {}) {
    selectable = new Set(nextSelectable);
    used = new Set(nextUsed);
    renderState();
  }
  function freeOffset(index, destination) {
    const occupied = positions.flatMap((position, other) => other !== index && wrapped(position) === wrapped(destination) ? [offsets[other]] : []);
    return [0, 36, -36, 72, -72, 108, -108].find(candidate => !occupied.includes(candidate)) ?? 0;
  }
  function move(index, distance, isPaused = () => false) {
    if (motion || !Number.isInteger(index) || index < 0 || index >= pieces.length || !Number.isInteger(distance) || distance < 0) return Promise.resolve(false);
    const origin = positions[index], destination = origin + distance;
    const originOffset = offsets[index], destinationOffset = freeOffset(index, destination);
    motion = { index, position: origin, offset: originOffset, hop: 0 };
    renderState();
    return new Promise(resolve => {
      let elapsed = 0, previous = performance.now();
      const duration = reducedMotion.matches || distance === 0 ? 0 : Math.max(450, Math.min(1800, distance * 110));
      const tick = now => {
        const paused = Boolean(isPaused());
        if (!paused) elapsed += now - previous;
        previous = now;
        if (paused) { requestAnimationFrame(tick); return; }
        const fraction = duration === 0 ? 1 : Math.min(1, elapsed / duration);
        const travelled = distance * fraction;
        const step = Math.min(distance, Math.floor(travelled));
        const withinStep = travelled - step;
        const eased = withinStep * withinStep * (3 - 2 * withinStep);
        motion.position = fraction === 1 ? destination : origin + step + eased;
        motion.offset = blend(originOffset, destinationOffset, fraction);
        motion.hop = fraction === 1 || reducedMotion.matches ? 0 : Math.sin(withinStep * Math.PI) * 4;
        pose(index, motion.position, motion.offset, motion.hop);
        if (fraction < 1) { requestAnimationFrame(tick); return; }
        positions[index] = destination;
        offsets[index] = destinationOffset;
        motion = null;
        renderState();
        resolve(true);
      };
      requestAnimationFrame(tick);
    });
  }
  function updateTheme() {
    const theme = document.body.dataset.theme || 'royal-club';
    const anchors = {
      'royal-club': [88.1, 80.8],
      'imperial-porcelain': [88.5, 80.3],
      nocturne: [92.4, 81.6],
    }[theme] || [88.1, 80.8];
    pieces.forEach((button, index) => button.style.setProperty('--base-anchor', `${anchors[index < 4 ? 0 : 1]}%`));
    layer.style.setProperty('--horse-atlas', `url("horse-sprites-${theme}.png")`);
    layer.dataset.theme = theme;
    renderPositions();
  }

  window.previewHorses = { move, sync, get positions() { return [...positions]; } };
  window.addEventListener('preview-track-ready', renderPositions);
  new MutationObserver(updateTheme).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  updateTheme();
  renderState();
})();
