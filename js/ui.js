/**
 * HUD rendering, minimap, and chat system.
 */

class HUD {
  constructor() {
    this.barHp = document.getElementById('bar-hp');
    this.barEnergy = document.getElementById('bar-energy');
    this.barBoost = document.getElementById('bar-boost');
    this.valHp = document.getElementById('val-hp');
    this.valEnergy = document.getElementById('val-energy');
    this.valBoost = document.getElementById('val-boost');
    this.hudScore = document.getElementById('hud-score');
    this.hudKills = document.getElementById('hud-kills');
    this.hudSpeed = document.getElementById('hud-speed');
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapCanvas.width = 120;
    this.minimapCanvas.height = 120;
  }

  update(player, score = 0, kills = 0) {
    if (!player || !player.alive) return;

    const hp = Math.round(player.totalHp);
    const maxHp = Math.max(1, player.maxHp);
    const hpPct = Math.round(player.hpRatio * 100);
    const energyPct = Math.round((player.energy / player.maxEnergy) * 100);
    const boostPct = Math.round((player.boostFuel / player.maxBoostFuel) * 100);

    this.barHp.style.width = hpPct + '%';
    this.barEnergy.style.width = energyPct + '%';
    this.barBoost.style.width = boostPct + '%';
    this.valHp.textContent = hp;
    this.valEnergy.textContent = energyPct;
    this.valBoost.textContent = boostPct;

    this.hudScore.textContent = 'Punkte: ' + score;
    this.hudKills.textContent = 'Kills: ' + kills;
    this.hudSpeed.textContent = Math.round(player.body.speed) + ' m/s';
  }

  drawMinimap(player, enemies, asteroids, worldSize) {
    const ctx = this.minimapCtx;
    const w = 120, h = 120;
    const scale = w / worldSize;

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(30,60,100,0.3)';
    ctx.lineWidth = 0.5;
    const gridStep = worldSize / 8 * scale;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * gridStep, 0); ctx.lineTo(i * gridStep, h);
      ctx.moveTo(0, i * gridStep); ctx.lineTo(w, i * gridStep);
      ctx.stroke();
    }

    // Asteroids
    for (const a of asteroids) {
      if (!a.alive) continue;
      const sx = (a.x + worldSize / 2) * scale;
      const sy = (a.y + worldSize / 2) * scale;
      ctx.fillStyle = '#554';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, a.radius * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      const sx = (e.body.pos.x + worldSize / 2) * scale;
      const sy = (e.body.pos.y + worldSize / 2) * scale;
      ctx.fillStyle = '#f64';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    if (player && player.alive) {
      const sx = (player.body.pos.x + worldSize / 2) * scale;
      const sy = (player.body.pos.y + worldSize / 2) * scale;

      // Direction indicator
      ctx.strokeStyle = '#8cf';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(
        sx + Math.cos(player.body.angle) * 7,
        sy + Math.sin(player.body.angle) * 7
      );
      ctx.stroke();

      ctx.fillStyle = '#4cf';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = '#1a3050';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
}

class Chat {
  constructor() {
    this.container = document.getElementById('chat-messages');
    this.inputRow = document.getElementById('chat-input-row');
    this.input = document.getElementById('chat-input');
    this.messages = [];
    this.isOpen = false;
    this.onSend = null;

    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const msg = this.input.value.trim();
        if (msg && this.onSend) this.onSend(msg);
        this.input.value = '';
        this.close();
        e.stopPropagation();
      } else if (e.key === 'Escape') {
        this.input.value = '';
        this.close();
        e.stopPropagation();
      }
      e.stopPropagation();
    });
  }

  open() {
    this.isOpen = true;
    this.inputRow.classList.remove('hidden');
    this.input.focus();
  }

  close() {
    this.isOpen = false;
    this.inputRow.classList.add('hidden');
    this.input.blur();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  addMessage(name, text, isSystem = false) {
    const msg = { name, text, isSystem, time: Date.now() };
    this.messages.push(msg);
    if (this.messages.length > 50) this.messages.shift();

    const el = document.createElement('div');
    el.className = 'chat-msg';
    if (isSystem) {
      el.innerHTML = `<span class="chat-system">${escapeHtml(text)}</span>`;
    } else {
      el.innerHTML = `<span class="chat-name">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
    }
    this.container.appendChild(el);
    this.container.scrollTop = this.container.scrollHeight;

    // Fade out after 8 seconds
    setTimeout(() => {
      el.style.transition = 'opacity 2s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 2000);
    }, 8000);
  }

  addSystem(text) {
    this.addMessage('', text, true);
  }
}

class PlayerListUI {
  constructor() {
    this.el = document.getElementById('player-list');
    this.content = document.getElementById('player-list-content');
    this.visible = false;
  }

  show(players) {
    this.visible = true;
    this.el.classList.remove('hidden');
    this.content.innerHTML = '';

    const sorted = [...players].sort((a, b) => b.kills - a.kills);
    for (const p of sorted) {
      const row = document.createElement('div');
      row.className = 'player-entry';
      row.innerHTML = `
        <span class="pname">${escapeHtml(p.name)}</span>
        <span class="pkills">K: ${p.kills}</span>
        <span class="pdeaths">D: ${p.deaths}</span>
      `;
      this.content.appendChild(row);
    }
  }

  hide() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  toggle(players) {
    if (this.visible) this.hide();
    else this.show(players);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Star background renderer — 3-layer parallax + nebula clouds + twinkle
class StarField {
  constructor(count = 400) {
    // Star colors: mostly white, some tinted blue/orange/yellow
    this.layers = [
      { stars: this._gen(count * 0.55, 0.18, 0.8),  speed: 0.04 },  // Far, tiny
      { stars: this._gen(count * 0.30, 0.45, 1.2),  speed: 0.18 },  // Mid
      { stars: this._gen(count * 0.15, 0.85, 1.8),  speed: 0.45 },  // Near, bright
    ];
    this.nebulae = this._genNebulae(6);
    this._t = 0;
  }

  _gen(count, brightness, maxR) {
    const tints = [
      [255,255,255], [200,220,255], [255,230,200], [220,255,255],
      [255,255,220], [200,200,255],
    ];
    const stars = [];
    for (let i = 0; i < count; i++) {
      const tint = tints[Math.floor(Math.random() * tints.length)];
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * maxR + 0.4,
        b: brightness * (0.4 + Math.random() * 0.6),
        twinkle: Math.random() < 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        tint,
      });
    }
    return stars;
  }

  _genNebulae(count) {
    const colors = [
      [30, 10, 80],   // purple
      [0, 20, 60],    // deep blue
      [60, 10, 30],   // dark red
      [0, 40, 50],    // teal
    ];
    const n = [];
    for (let i = 0; i < count; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      n.push({
        x: Math.random(),
        y: Math.random(),
        rx: 0.15 + Math.random() * 0.25,
        ry: 0.08 + Math.random() * 0.18,
        rot: Math.random() * Math.PI,
        alpha: 0.04 + Math.random() * 0.06,
        color: c,
        speed: 0.01,
      });
    }
    return n;
  }

  draw(ctx, camX, camY, zoom, w, h) {
    this._t += 0.016;

    // ── Nebula clouds (very subtle) ───────────────────────────────────
    for (const nb of this.nebulae) {
      const px = ((nb.x + camX * nb.speed / 10000) % 1 + 1) % 1;
      const py = ((nb.y + camY * nb.speed / 10000) % 1 + 1) % 1;
      const sx = px * w, sy = py * h;
      const rw = nb.rx * w, rh = nb.ry * h;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(nb.rot);
      const [r2, g2, b2] = nb.color;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
      grad.addColorStop(0, `rgba(${r2},${g2},${b2},${nb.alpha})`);
      grad.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);
      ctx.fillStyle = grad;
      ctx.scale(1, rh / rw);
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Stars ─────────────────────────────────────────────────────────
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        const px = ((s.x + camX * layer.speed / 10000) % 1 + 1) % 1;
        const py = ((s.y + camY * layer.speed / 10000) % 1 + 1) % 1;
        const sx = px * w, sy = py * h;

        let alpha = s.b;
        if (s.twinkle) {
          alpha *= 0.5 + 0.5 * Math.sin(this._t * s.speed + s.phase);
        }

        const [r2, g2, b2] = s.tint;

        // Glow for brighter stars
        if (s.r > 1.2) {
          ctx.globalAlpha = alpha * 0.3;
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 3);
          grd.addColorStop(0, `rgba(${r2},${g2},${b2},1)`);
          grd.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
