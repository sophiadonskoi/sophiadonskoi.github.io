// ===== Studio feed: Facebook-Reels-style motion =====
// • The feed follows your finger (or mouse) exactly. Hold it halfway and you see half of each video.
// • Let go and it glides to the nearest video, or on to the next one if you flicked.
// • The glide is a physics spring that starts at your finger's speed, so it never jumps or snaps.
(function () {
  const feed = document.querySelector('.feed');
  const posts = Array.from(feed.querySelectorAll('.post'));
  const videos = posts.map((p) => p.querySelector('video'));
  const soundBtns = posts.map((p) => p.querySelector('.reel-sound'));
  const upBtn = document.querySelector('.feed-up');
  const downBtn = document.querySelector('.feed-down');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const last = posts.length - 1;

  // ---- feel (tweak these to taste) ----
  const SPRING = 15;          // higher = faster glide (15 ≈ 0.45s, no bounce)
  const FLICK_SPEED = 350;    // px per second; a flick faster than this moves to the next video
  const DRAG_START = 6;       // px of movement before a touch counts as a drag

  let H = 1;          // height of one post
  let pos = 0;        // how far down the feed we are, in px (0 = first video)
  let vel = 0;        // px per second
  let target = 0;     // where the glide is heading
  let index = 0;      // the video we're on / heading to
  let raf = null;
  let muted = true;

  // ---------- drawing ----------
  function measure() {
    H = posts[0].getBoundingClientRect().height || window.innerHeight;
  }

  // Rubber band past the first / last video (like iOS)
  function rubber(p) {
    const max = last * H;
    const band = (x) => (1 - 1 / ((x * 0.55) / H + 1)) * H;
    if (p < 0) return -band(-p);
    if (p > max) return max + band(p - max);
    return p;
  }

  function paint(p) {
    feed.style.transform = 'translate3d(0,' + (-p) + 'px,0)';
    updatePlayback(p);
  }

  // ---------- video playback: whatever is on screen plays ----------
  let playingKey = '';
  function updatePlayback(p) {
    const a = Math.max(0, Math.min(last, Math.floor(p / H + 0.001)));
    const b = Math.max(0, Math.min(last, Math.ceil(p / H - 0.001)));
    const key = a + '-' + b;
    if (key === playingKey) return;
    const was = playingKey.split('-').map(Number);
    playingKey = key;
    videos.forEach((v, i) => {
      if (!v) return;
      v.muted = muted;
      if (i === a || i === b) {
        if (!was.includes(i)) { try { v.currentTime = 0; } catch (e) {} }
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
      } else {
        v.pause();
      }
    });
  }

  // ---------- the glide (critically damped spring) ----------
  let lastT = 0;
  function tick(now) {
    let dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const k = SPRING * SPRING, c = 2 * SPRING;
    while (dt > 0) {
      const h = Math.min(dt, 0.004);
      const a = -k * (pos - target) - c * vel;
      vel += a * h;
      pos += vel * h;
      dt -= h;
    }
    if (Math.abs(pos - target) < 0.5 && Math.abs(vel) < 20) {
      pos = target; vel = 0; raf = null;
      paint(pos);
      return;
    }
    paint(pos);
    raf = requestAnimationFrame(tick);
  }

  function glideTo(i, startVel) {
    index = Math.max(0, Math.min(last, i));
    target = index * H;
    if (typeof startVel === 'number') vel = startVel;
    if (upBtn) upBtn.disabled = index === 0;
    if (downBtn) downBtn.disabled = index === last;
    if (reduceMotion) {
      cancelAnimationFrame(raf); raf = null;
      pos = target; vel = 0; paint(pos);
      return;
    }
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function stopGlide() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  // ---------- dragging (finger or mouse) ----------
  let pointerId = null, startY = 0, startX = 0, startPos = 0, startIndex = 0;
  let dragging = false, interrupted = false, onButton = false, onVideo = false;
  let samples = [];

  feed.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startY = e.clientY; startX = e.clientX;
    onButton = !!e.target.closest('button');
    onVideo = !!e.target.closest('.reel');
    interrupted = !!raf;          // grabbing a video mid-glide stops it in place
    stopGlide();
    vel = 0;
    startPos = pos;
    startIndex = Math.round(pos / H);
    dragging = false;
    samples = [{ t: e.timeStamp, y: e.clientY }];
  });

  feed.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dy) < DRAG_START && Math.abs(e.clientX - startX) < DRAG_START) return;
      dragging = true;
      feed.classList.add('is-dragging');
      try { feed.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
    pos = startPos - dy;
    paint(rubber(pos));
    samples.push({ t: e.timeStamp, y: e.clientY });
    const cutoff = e.timeStamp - 100;
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
  });

  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    feed.classList.remove('is-dragging');

    if (!dragging) {
      if (interrupted) { glideTo(Math.round(pos / H), 0); return; }
      if (onVideo && !onButton) toggleSound();   // tap the video = sound on/off
      return;
    }
    dragging = false;

    // finger speed over the last ~100ms (px/s, in feed direction)
    const first = samples[0], lastS = samples[samples.length - 1];
    const dt = Math.max(1, lastS.t - first.t);
    let v = -((lastS.y - first.y) / dt) * 1000;
    if (e.type === 'pointercancel' || e.timeStamp - lastS.t > 80) v = 0; // held still, then let go

    pos = rubber(pos);  // continue from what's on screen
    let to;
    if (Math.abs(v) > FLICK_SPEED) {
      to = v > 0 ? Math.floor(pos / H + 0.02) + 1 : Math.ceil(pos / H - 0.02) - 1;
    } else {
      to = Math.round(pos / H);
    }
    to = Math.max(startIndex - 1, Math.min(startIndex + 1, to)); // one video per swipe
    glideTo(to, Math.max(-6000, Math.min(6000, v)));
  }

  feed.addEventListener('pointerup', release);
  feed.addEventListener('pointercancel', release);
  feed.addEventListener('dragstart', (e) => e.preventDefault());

  // ---------- mouse wheel / trackpad: one video per gesture ----------
  let wLock = false, wSum = 0, wTimer;
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    clearTimeout(wTimer);
    wTimer = setTimeout(() => { wLock = false; wSum = 0; }, 160);
    if (wLock || pointerId !== null) return;
    wSum += e.deltaY;
    if (Math.abs(wSum) > 30) {
      wLock = true;
      glideTo(index + (wSum > 0 ? 1 : -1));
      wSum = 0;
    }
  }, { passive: false });

  // ---------- arrows + keyboard ----------
  if (upBtn) upBtn.addEventListener('click', () => glideTo(index - 1));
  if (downBtn) downBtn.addEventListener('click', () => glideTo(index + 1));

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.target.closest && e.target.closest('button')) return;
    if (['ArrowDown', 'PageDown', ' ', 'j'].includes(e.key)) { e.preventDefault(); glideTo(index + 1); }
    if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); glideTo(index - 1); }
  });

  // ---------- sound (shared across the feed, like the app) ----------
  function toggleSound() {
    muted = !muted;
    videos.forEach((v) => { if (v) v.muted = muted; });
    soundBtns.forEach((b) => {
      if (!b) return;
      b.setAttribute('aria-pressed', String(!muted));
      b.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    });
  }
  soundBtns.forEach((b) => b && b.addEventListener('click', toggleSound));

  // ---------- start ----------
  window.addEventListener('resize', () => {
    measure();
    stopGlide();
    pos = target = index * H;
    vel = 0;
    paint(pos);
  });

  measure();
  glideTo(0, 0);
  paint(0);
})();
