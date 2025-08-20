
(() => {
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  // ===== Audio (Web Audio API) =====
  const SOUND_ENABLED = true;
  let audio = null;

  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.04;
    master.connect(ctx.destination);

    function beep(freq=440, dur=0.08, type='square', vol=0.6) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(master);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    function noiseBurst(dur=0.12, vol=0.5) {
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * 0.7;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(gain);
      gain.connect(master);
      src.start(now);
    }

    return {
      ctx,
      resume: () => ctx.resume && ctx.resume(),
      step: () => { const base = 380 + Math.random()*40; beep(base, 0.07, 'square', 0.35); },
      shoot: () => { const f = 880 + Math.random()*40; beep(f, 0.06, 'triangle', 0.45); },
      explosion: () => noiseBurst(0.12, 0.45),
      playerDie: () => { beep(220, 0.10, 'sawtooth', 0.5); setTimeout(() => beep(196, 0.12, 'sawtooth', 0.5), 120); }
    };
  }

  // ===== Tunables (sizes & spacing, v3) =====
  const INVADER_SCALE = 0.58;
  const SHIP_SCALE    = 0.52;
  const GAP_X         = 88;
  const GAP_Y         = 56;

  // ===== Bullet sizes (NEW) =====
  const PLAYER_BULLET_W = 4;   // antes 2
  const PLAYER_BULLET_H = 14;  // antes 10
  const ALIEN_BULLET_W  = 4;   // antes 2
  const ALIEN_BULLET_H  = 12;  // antes 10

  // Shields
  const BLOCK = 6;
  const SHIELD_COLOR = "#3dd13d";

  // ===== Gameplay constants (modo screensaver) =====
  const COLS = 11, ROWS = 5;
  const PLAYER_SPEED = 85;
  const PLAYER_FIRE_COOLDOWN = 0.9;
  const INVADER_STEP_SPEED = 28;
  const INVADER_SPEED_MAX = 165;
  const INVADER_ANIM_PERIOD = 0.35;
  const STEP_DOWN = 12;
  const ALIEN_FIRE_COOLDOWN = 1.2;
  const ALIEN_BULLET_SPEED = 150;
  const PLAYER_BULLET_SPEED = 320;
  const RESET_DELAY = 2.0;

  const images = {};
  const loadImage = (name) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'assets/' + name;
  });

  const state = {
    w: 1024, h: 640,
    t: 0, prev: 0,
    shipX: 512, shipY: 590,
    playerBullet: null,
    playerCooldown: 0,
    invaders: [], invDir: 1, invSpeed: INVADER_STEP_SPEED,
    animToggle: false, animElapsed: 0,
    alienCooldown: 0,
    alienBullets: [],
    shields: [],
    gameOver: false, youWin: false, resetTimer: 0
  };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    state.w = canvas.width;
    state.h = canvas.height;
    state.shipY = state.h - 50 * DPR;
    buildInvaders();
    buildShields();
  }
  window.addEventListener('resize', resize);

  function buildInvaders() {
    const gapX = GAP_X * DPR, gapY = GAP_Y * DPR;
    const totalWidth = (COLS - 1) * gapX;
    const startX = (state.w - totalWidth) / 2;
    const startY = 120 * DPR;
    state.invaders = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        state.invaders.push({
          col: c, row: r, alive: true,
          x: startX + c * gapX,
          y: startY + r * gapY
        });
      }
    }
    state.invDir = 1;
    state.invSpeed = INVADER_STEP_SPEED;
  }

  const SHAPE = [
    "    #########    ",
    "   ###########   ",
    "  #############  ",
    " ############### ",
    " ############### ",
    " ############### ",
    " ######   ###### ",
    " #####     ##### ",
    " ####       #### ",
    " ###         ### "
  ];

  function buildShields() {
    const shieldCount = 4;
    const marginSide = 120 * DPR;
    const available = state.w - 2 * marginSide;
    const spacing = available / (shieldCount - 1);
    const baseY = state.h - 160 * DPR;

    state.shields = [];
    for (let i = 0; i < shieldCount; i++) {
      const x = marginSide + i * spacing;
      const cells = [];
      for (let r = 0; r < SHAPE.length; r++) {
        for (let c = 0; c < SHAPE[r].length; c++) {
          if (SHAPE[r][c] === '#') {
            cells.push({
              dx: (c - SHAPE[r].length/2) * BLOCK * DPR,
              dy: (r - SHAPE.length/2) * BLOCK * DPR,
              alive: true
            });
          }
        }
      }
      state.shields.push({ x, y: baseY, cells });
    }
  }

  function drawImageCentered(img, x, y, scale=1) {
    if (!img) return;
    const w = img.naturalWidth * scale * DPR;
    const h = img.naturalHeight * scale * DPR;
    ctx.drawImage(img, x - w/2, y - h/2, w, h);
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function lowestAliveInColumn(col) {
    let result = null;
    for (const inv of state.invaders) {
      if (inv.col === col && inv.alive) {
        if (!result || inv.row > result.row) result = inv;
      }
    }
    return result;
  }

  function anyInvadersAlive() {
    return state.invaders.some(i => i.alive);
  }

  function update(dt) {
    if (state.gameOver) {
      state.resetTimer -= dt;
      if (state.resetTimer <= 0) resetGame();
      return;
    }

    state.t += dt;
    state.animElapsed += dt;
    state.playerCooldown -= dt;
    state.alienCooldown -= dt;

    // Auto-move player
    state.shipX += 85 * DPR * dt * (state.playerDir || (state.playerDir = 1));
    if (state.shipX > state.w - 30*DPR) { state.shipX = state.w - 30*DPR; state.playerDir = -1; }
    if (state.shipX < 30*DPR) { state.shipX = 30*DPR; state.playerDir = 1; }

    // Auto-fire (bala más grande)
    if (!state.playerBullet && state.playerCooldown <= 0) {
      state.playerBullet = {
        x: state.shipX,
        y: state.shipY - 18*DPR,
        w: PLAYER_BULLET_W * DPR,
        h: PLAYER_BULLET_H * DPR,
        vy: -PLAYER_BULLET_SPEED * DPR
      };
      state.playerCooldown = PLAYER_FIRE_COOLDOWN * (0.8 + Math.random()*0.4);
      if (SOUND_ENABLED && audio) audio.shoot();
    }
    if (state.playerBullet) {
      state.playerBullet.y += state.playerBullet.vy * dt;
      if (state.playerBullet.y + state.playerBullet.h < 0) state.playerBullet = null;
    }

    // Invaders move
    let hitEdge = false;
    for (const inv of state.invaders) {
      if (!inv.alive) continue;
      inv.x += state.invDir * state.invSpeed * DPR * dt;
      if (inv.x < 20 * DPR || inv.x > state.w - 20*DPR) hitEdge = true;
    }
    if (hitEdge) {
      state.invDir *= -1;
      for (const inv of state.invaders) if (inv.alive) inv.y += STEP_DOWN * DPR;
      state.invSpeed = Math.min(state.invSpeed * 1.04, INVADER_SPEED_MAX);
    }
    if (state.animElapsed > INVADER_ANIM_PERIOD) {
      state.animElapsed = 0;
      state.animToggle = !state.animToggle;
      if (SOUND_ENABLED && audio) audio.step();
    }

    // Alien fire (balas más grandes)
    if (state.alienCooldown <= 0) {
      const columns = Array.from({length: COLS}, (_,i)=>i);
      while (columns.length) {
        const idx = Math.floor(Math.random()*columns.length);
        const col = columns.splice(idx, 1)[0];
        const shooter = lowestAliveInColumn(col);
        if (shooter) {
          state.alienBullets.push({
            x: shooter.x,
            y: shooter.y + 12*DPR,
            w: ALIEN_BULLET_W * DPR,
            h: ALIEN_BULLET_H * DPR,
            vy: ALIEN_BULLET_SPEED * DPR
          });
          break;
        }
      }
      state.alienCooldown = ALIEN_FIRE_COOLDOWN * (0.7 + Math.random()*0.6);
    }
    for (const b of state.alienBullets) b.y += b.vy * dt;
    state.alienBullets = state.alienBullets.filter(b => b.y < state.h + 20*DPR);

    // Collisions: player bullet vs invaders
    if (state.playerBullet) {
      for (const inv of state.invaders) {
        if (!inv.alive) continue;
        const tex = state.animToggle ? images.InvaderB : images.InvaderA;
        const iw = (tex ? tex.naturalWidth : 24) * INVADER_SCALE * DPR;
        const ih = (tex ? tex.naturalHeight: 16) * INVADER_SCALE * DPR;
        const ix = inv.x - iw/2, iy = inv.y - ih/2;
        if (rectsOverlap(state.playerBullet.x, state.playerBullet.y, state.playerBullet.w, state.playerBullet.h, ix, iy, iw, ih)) {
          inv.alive = false;
          state.playerBullet = null;
          if (SOUND_ENABLED && audio) audio.explosion();
          break;
        }
      }
    }

    function bulletHitsShield(bullet) {
      for (const sh of state.shields) {
        for (const c of sh.cells) {
          if (!c.alive) continue;
          const bx = sh.x + c.dx, by = sh.y + c.dy;
          if (rectsOverlap(bullet.x, bullet.y, bullet.w, bullet.h, bx, by, BLOCK*DPR, BLOCK*DPR)) {
            c.alive = false;
            return true;
          }
        }
      }
      return false;
    }

    if (state.playerBullet && bulletHitsShield(state.playerBullet)) state.playerBullet = null;
    state.alienBullets = state.alienBullets.filter(b => !bulletHitsShield(b));

    const shipW = (images.Ship ? images.Ship.naturalWidth : 24) * SHIP_SCALE * DPR;
    const shipH = (images.Ship ? images.Ship.naturalHeight: 16) * SHIP_SCALE * DPR;
    const sx = state.shipX - shipW/2, sy = state.shipY - shipH/2;
    for (const b of state.alienBullets) {
      if (rectsOverlap(b.x, b.y, b.w, b.h, sx, sy, shipW, shipH)) {
        state.gameOver = true; state.youWin = false; state.resetTimer = RESET_DELAY;
        if (SOUND_ENABLED && audio) audio.playerDie();
        return;
      }
    }

    if (!anyInvadersAlive()) { state.gameOver = true; state.youWin = true; state.resetTimer = RESET_DELAY; }
    for (const inv of state.invaders) if (inv.alive && inv.y > state.shipY - 40*DPR) { state.gameOver = true; state.youWin = false; state.resetTimer = RESET_DELAY; break; }
  }

  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, state.w, state.h);

    // Shields
    ctx.fillStyle = SHIELD_COLOR;
    for (const sh of state.shields) {
      for (const c of sh.cells) {
        if (!c.alive) continue;
        ctx.fillRect(sh.x + c.dx, sh.y + c.dy, BLOCK*DPR, BLOCK*DPR);
      }
    }

    // Invaders
    const tex = state.animToggle ? images.InvaderB : images.InvaderA;
    for (const inv of state.invaders) if (inv.alive) {
      drawImageCentered(tex, inv.x, inv.y, INVADER_SCALE);
    }

    // Player
    drawImageCentered(images.Ship, state.shipX, state.shipY, SHIP_SCALE);

    // Bullets (larger)
    ctx.fillStyle = "#fff";
    if (state.playerBullet) ctx.fillRect(state.playerBullet.x, state.playerBullet.y, state.playerBullet.w, state.playerBullet.h);
    for (const b of state.alienBullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    if (state.gameOver) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#000";
      const bw = 400*DPR, bh = 120*DPR;
      ctx.fillRect((state.w-bw)/2, (state.h-bh)/2, bw, bh);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#fff";
      ctx.font = (36*DPR) + "px monospace";
      ctx.textAlign = "center";
      ctx.fillText(state.youWin ? "YOU WIN" : "GAME OVER", state.w/2, state.h/2);
    }
  }

  function resetGame() {
    state.gameOver = false; state.youWin = false;
    state.playerBullet = null; state.alienBullets = [];
    state.playerCooldown = 0; state.alienCooldown = 0.5;
    state.shipX = state.w/2; state.playerDir = Math.random() > 0.5 ? 1 : -1;
    buildInvaders();
    buildShields();
  }

  function loop(ts) {
    if (!state.prev) state.prev = ts;
    const dt = Math.min(0.05, (ts - state.prev) / 1000);
    state.prev = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  Promise.all([
    loadImage('Ship.gif').then(i => images.Ship = i),
    loadImage('InvaderA.gif').then(i => images.InvaderA = i),
    loadImage('InvaderB.gif').then(i => images.InvaderB = i),
    loadImage('GameOver.gif').then(i => images.GameOver = i),
  ]).then(() => {
    if (SOUND_ENABLED) {
      try { audio = makeAudio(); if (audio && audio.resume) audio.resume(); } catch(e) { console.warn('Audio no disponible:', e); }
    }
    resize();
    resetGame();
    requestAnimationFrame(loop);
  }).catch(err => {
    console.error('Error cargando imágenes', err);
    resize();
    ctx.fillStyle = '#fff';
    ctx.font = (20*DPR) + "px monospace";
    ctx.fillText("Error cargando imágenes", 40*DPR, 60*DPR);
  });
})();
