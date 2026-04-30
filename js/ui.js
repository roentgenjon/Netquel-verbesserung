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

// Star background renderer
class StarField {
  constructor(count = 300) {
    this.layers = [
      { stars: this._gen(count * 0.5, 0.2), speed: 0.05 },  // Far
      { stars: this._gen(count * 0.3, 0.5), speed: 0.2 },   // Mid
      { stars: this._gen(count * 0.2, 1.0), speed: 0.5 },   // Near
    ];
  }

  _gen(count, brightness) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.5 + 0.5,
        b: brightness * (0.5 + Math.random() * 0.5),
      });
    }
    return stars;
  }

  draw(ctx, camX, camY, zoom, w, h) {
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        // Parallax: stars wrap around and move slowly with camera
        const px = ((s.x + camX * layer.speed / 10000) % 1 + 1) % 1;
        const py = ((s.y + camY * layer.speed / 10000) % 1 + 1) % 1;
        const sx = px * w;
        const sy = py * h;
        ctx.fillStyle = `rgba(255,255,255,${s.b})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
