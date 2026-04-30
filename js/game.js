/**
 * Main game controller — state machine, game loop, world management.
 */

const GAME_STATE = { MENU: 'menu', EDITOR: 'editor', PLAYING: 'playing', PAUSED: 'paused' };
const WORLD_SIZE = 4000; // world is WORLD_SIZE x WORLD_SIZE centered at origin
const ENEMY_COUNT = 8;
const ASTEROID_COUNT = 30;
const SPAWN_MARGIN = 200;

class Game {
  constructor() {
    this.state = GAME_STATE.MENU;
    this.lastTime = 0;
    this.score = 0;
    this.frameCount = 0;

    // Canvases
    this.gameCanvas = document.getElementById('game-canvas');
    this.gameCtx = this.gameCanvas.getContext('2d');
    this.editorCanvasEl = document.getElementById('editor-canvas');

    // Systems
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.particles = new ParticleSystem();
    this.weapons = new WeaponSystem();
    this.hud = new HUD();
    this.chat = new Chat();
    this.playerList = new PlayerListUI();
    this.starField = new StarField(400);
    this.editor = new ShipEditor(this.editorCanvasEl);
    this.input = new InputHandler(this.gameCanvas);

    // World entities
    this.player = null;
    this.enemies = [];
    this.aiControllers = [];
    this.asteroids = [];

    // Bot names
    this._botNames = ['Zephyr', 'Orion', 'Nexus', 'Vega', 'Draco', 'Sirius', 'Altair', 'Rigel', 'Castor', 'Pollux'];

    this._setupUI();
    this._setupInput();
    this._resize();

    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gameCanvas.width = w;
    this.gameCanvas.height = h;
    this.editorCanvasEl.width = w;
    this.editorCanvasEl.height = h;
    this.camera.resize(w, h);
  }

  // ── UI BINDINGS ──────────────────────────────────────────────────────────────

  _setupUI() {
    // Menu
    document.getElementById('btn-play').addEventListener('click', () => this._startGame());
    document.getElementById('btn-editor').addEventListener('click', () => this._openEditor());
    document.getElementById('btn-controls').addEventListener('click', () => this._showScreen('controls-screen'));
    document.getElementById('btn-back-controls').addEventListener('click', () => this._showScreen('menu-screen'));

    // Editor
    document.getElementById('btn-editor-play').addEventListener('click', () => this._startGameFromEditor());
    document.getElementById('btn-editor-clear').addEventListener('click', () => {
      if (confirm('Alle Blöcke löschen?')) this.editor.clear();
    });
    document.getElementById('btn-editor-save').addEventListener('click', () => {
      if (this.editor.save()) this.chat.addSystem('Schiff gespeichert!');
    });
    document.getElementById('btn-editor-load').addEventListener('click', () => {
      if (this.editor.load()) this.chat.addSystem('Schiff geladen!');
    });
    document.getElementById('btn-editor-menu').addEventListener('click', () => this._showScreen('menu-screen'));

    // Game HUD
    document.getElementById('btn-game-menu').addEventListener('click', () => this._togglePause());

    // Death screen
    document.getElementById('btn-respawn').addEventListener('click', () => this._respawn());
    document.getElementById('btn-death-menu').addEventListener('click', () => {
      this._showDeathScreen(false);
      this._showScreen('menu-screen');
    });

    // Pause menu
    document.getElementById('btn-resume').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-pause-editor').addEventListener('click', () => {
      this._togglePause();
      this._openEditor();
    });
    document.getElementById('btn-pause-menu').addEventListener('click', () => {
      this._hidePause();
      this._showScreen('menu-screen');
    });

    // Chat
    this.chat.onSend = (msg) => {
      if (this.player) {
        this.chat.addMessage(this.player.name, msg);
      }
      // Simulate bot replies occasionally
      if (Math.random() < 0.3 && this.enemies.length > 0) {
        const bot = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        const replies = ['Gib auf!', 'Du hast keine Chance!', 'Ich werde dich zerstören!', 'Interessant...', 'Ha!'];
        setTimeout(() => {
          this.chat.addMessage(bot.name, replies[Math.floor(Math.random() * replies.length)]);
        }, randRange(500, 2000));
      }
    };
  }

  _setupInput() {
    this.input.on('keydown', e => {
      if (this.state !== GAME_STATE.PLAYING) return;

      if (e.code === 'KeyT' && !this.chat.isOpen) {
        this.chat.open();
        this.input.chatMode = true;
        return;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        this.playerList.toggle(this._getAllPlayers());
        return;
      }
      if (e.code === 'Escape') {
        if (this.playerList.visible) { this.playerList.hide(); return; }
        this._togglePause();
        return;
      }
      if (e.code === 'KeyR' && this.player && !this.player.alive) {
        this._respawn();
        return;
      }
      if (e.code === 'F5') {
        e.preventDefault();
        return;
      }
    });

    this.input.on('keyup', e => {
      if (e.code === 'Tab') {
        this.playerList.hide();
      }
    });

    // Chat close
    this.input.on('keydown', e => {
      if (e.code === 'Escape' && this.chat.isOpen) {
        this.chat.close();
        this.input.chatMode = false;
      }
    });
  }

  // ── SCREEN MANAGEMENT ────────────────────────────────────────────────────────

  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    this.editor.deactivate();

    if (id === 'editor-screen') {
      this.state = GAME_STATE.EDITOR;
      this.editor.activate();
    } else if (id === 'game-screen') {
      this.state = GAME_STATE.PLAYING;
    } else {
      this.state = GAME_STATE.MENU;
    }
  }

  _openEditor() {
    if (this.editor.blocks.size === 0) this.editor.loadDefault();
    this._showScreen('editor-screen');
  }

  // ── GAME START ───────────────────────────────────────────────────────────────

  _startGame(playerShip = null) {
    this.score = 0;
    this.weapons.projectiles = [];
    this.particles.particles = [];

    // Create player ship
    if (playerShip) {
      this.player = playerShip;
    } else {
      // Try loading saved ship
      const savedOk = this.editor.load();
      const blocks = savedOk ? this.editor.getShipBlocks() : null;
      if (blocks && blocks.length > 0 && blocks.some(b => b.type.isCockpit)) {
        this.player = new Ship(blocks, 'Spieler');
      } else {
        this.player = Ship.createDefault('Spieler');
      }
    }

    this.player.isPlayer = true;
    this.player.body.pos.x = 0;
    this.player.body.pos.y = 0;
    this.player.body.angle = -Math.PI / 2; // Face up

    // Spawn enemies
    this.enemies = [];
    this.aiControllers = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      this._spawnEnemy(i);
    }

    // Spawn asteroids
    this.asteroids = [];
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      this._spawnAsteroid();
    }

    this.camera.x = 0; this.camera.y = 0;
    this.camera.targetX = 0; this.camera.targetY = 0;
    this.camera.zoom = 1; this.camera.targetZoom = 1;

    this._showScreen('game-screen');
    this._hideDeathScreen();
    this._hidePause();

    this.chat.addSystem('Willkommen in Netquel! W/S = Schub, A/D = Drehen, E = Boost, Leertaste = Schießen, T = Chat');
    setTimeout(() => this.chat.addSystem('Tip: Tab = Spielerliste, Esc = Pause'), 3000);
  }

  _startGameFromEditor() {
    const blocks = this.editor.getShipBlocks();
    if (blocks.length === 0) {
      alert('Dein Schiff ist leer! Platziere mindestens ein Cockpit und ein Triebwerk.');
      return;
    }
    if (!blocks.some(b => b.type.isCockpit)) {
      alert('Dein Schiff braucht ein Cockpit (Block-Typ 2)!');
      return;
    }
    const ship = new Ship(blocks, 'Mein Schiff');
    this.editor.save();
    this._startGame(ship);
  }

  _spawnEnemy(index) {
    const angle = (index / ENEMY_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const dist = randRange(600, WORLD_SIZE / 2 - 200);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const difficulty = Math.min(3, 1 + Math.floor(index / 3));
    const name = this._botNames[index % this._botNames.length];

    const enemy = Ship.createEnemy(name, difficulty);
    enemy.body.pos.x = x;
    enemy.body.pos.y = y;
    enemy.body.angle = Math.random() * Math.PI * 2;
    this.enemies.push(enemy);

    const ai = new AIController(enemy);
    ai.setDifficulty(difficulty);
    ai.patrolCenter = new Vec2(x, y);
    this.aiControllers.push(ai);
  }

  _spawnAsteroid() {
    let x, y;
    do {
      x = randRange(-WORLD_SIZE / 2, WORLD_SIZE / 2);
      y = randRange(-WORLD_SIZE / 2, WORLD_SIZE / 2);
    } while (Math.abs(x) < 200 && Math.abs(y) < 200); // Away from spawn

    this.asteroids.push(new Asteroid(x, y));
  }

  _getAllPlayers() {
    const all = this.player ? [this.player] : [];
    return all.concat(this.enemies.filter(e => e.alive));
  }

  // ── RESPAWN ──────────────────────────────────────────────────────────────────

  _respawn() {
    this._hideDeathScreen();
    if (!this.player) return;

    // Find a safe spawn point
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(100, 300);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    // Reset blocks
    this.player.blocks = this.player.blocks.map(b => {
      const nb = new Block(b.type, b.gridX, b.gridY);
      return nb;
    });
    this.player._recalculate();
    this.player.respawn(x, y);
    this.player.deaths++;
    this.chat.addSystem('Respawn!');
  }

  // ── PAUSE ────────────────────────────────────────────────────────────────────

  _togglePause() {
    if (this.state === GAME_STATE.PAUSED) {
      this.state = GAME_STATE.PLAYING;
      this._hidePause();
    } else if (this.state === GAME_STATE.PLAYING) {
      this.state = GAME_STATE.PAUSED;
      document.getElementById('pause-menu').classList.remove('hidden');
    }
  }

  _hidePause() {
    document.getElementById('pause-menu').classList.add('hidden');
  }

  _showDeathScreen(killed = false, killerName = '') {
    const el = document.getElementById('death-screen');
    el.classList.remove('hidden');
    document.getElementById('death-msg').textContent =
      killed ? `Zerstört von ${killerName}` : 'Dein Schiff wurde vernichtet!';
  }

  _hideDeathScreen() {
    document.getElementById('death-screen').classList.add('hidden');
  }

  // ── MAIN LOOP ────────────────────────────────────────────────────────────────

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;
    this.frameCount++;

    if (this.state === GAME_STATE.PLAYING) {
      this._update(dt);
      this._draw();
    } else if (this.state === GAME_STATE.EDITOR) {
      this.editor.draw();
    } else if (this.state === GAME_STATE.PAUSED) {
      this._draw(); // draw frozen frame
    }

    requestAnimationFrame(t => this._loop(t));
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────────

  _update(dt) {
    if (!this.player) return;

    // Update mouse world position for aiming
    const worldMouse = this.camera.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    this.input.mouse.worldX = worldMouse.x;
    this.input.mouse.worldY = worldMouse.y;
    this.input._mouseAiming = true;

    // Player controls
    if (this.player.alive) {
      this.player._lastThrust = this.input.thrust || this.input.reverse;
      this.player.applyControls(this.input, dt);

      // Fire weapons
      if (this.input.fire && !this.chat.isOpen) {
        this.weapons.fire(this.player, 'LASER', this.particles);
        this.weapons.fire(this.player, 'CANNON', this.particles);
      }

      // Camera follow player
      this.camera.follow(this.player.body.pos.x, this.player.body.pos.y);

      // Dynamic zoom based on speed
      const speedFactor = Math.max(0, (this.player.body.speed - 100) / 400);
      this.camera.setZoom(1.0 - speedFactor * 0.3);
    }

    this.player.update(dt);

    // Check player death
    if (!this.player.alive && this.player.respawnTimer > 0) {
      this._showDeathScreen(false);
      this.particles.shipExplosion(this.player.body.pos.x, this.player.body.pos.y, 100);
      this.camera.addShake(20);
    }

    // AI update
    for (let i = 0; i < this.aiControllers.length; i++) {
      const ai = this.aiControllers[i];
      const enemy = this.enemies[i];

      if (!enemy.alive) {
        if (enemy.respawnTimer <= 0) {
          // Respawn enemy at edge
          this._respawnEnemy(i);
        } else {
          enemy.respawnTimer -= dt;
        }
        continue;
      }

      // Set target to player
      if (this.player.alive) ai.setTarget(this.player);

      ai.update(dt, this.weapons, this.particles);
      enemy._lastThrust = ai._virtualInput.thrust || ai._virtualInput.reverse;
      enemy.update(dt);

      // Check if enemy killed
      if (!enemy.alive) {
        this.particles.shipExplosion(enemy.body.pos.x, enemy.body.pos.y, 80);
        this.score += 100 * (ai.difficulty);
        if (this.player.alive) {
          this.player.kills++;
          this.chat.addMessage('', `${enemy.name} wurde zerstört! (+${100 * ai.difficulty} Punkte)`, true);
        }
        this.camera.addShake(8);
      }
    }

    // Weapon hits on player
    if (this.player.alive) {
      const hits = this.weapons.checkHits(this.player, this.particles);
      if (hits.length > 0) {
        this.camera.addShake(hits.length * 3);
      }

      // Drill attack check
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        if (!enemy.alive) continue;
        const dist = Vec2.dist(enemy.body.pos, this.player.body.pos);
        if (dist < 100) {
          this.weapons.drillAttack(enemy, this.player, this.particles);
        }
      }
    }

    // Weapon hits on enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const hits = this.weapons.checkHits(enemy, this.particles);
      if (hits.length > 0 && hits.some(h => h.proj.ownerId === this.player.id)) {
        this.score += 10;
      }
    }

    // Player drill on enemies
    if (this.input.fire && this.player.alive && !this.chat.isOpen) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const dist = Vec2.dist(this.player.body.pos, enemy.body.pos);
        if (dist < 100) {
          this.weapons.drillAttack(this.player, enemy, this.particles);
        }
      }
    }

    // Asteroid collisions with ships
    this._updateAsteroids(dt);

    // Weapons & particles
    this.weapons.update(dt);
    this.particles.update(dt);
    this.camera.update(dt);

    // HUD
    this.hud.update(this.player, this.score, this.player.kills);
    this.hud.drawMinimap(this.player, this.enemies, this.asteroids, WORLD_SIZE);

    // Replenish asteroids
    const aliveAsteroids = this.asteroids.filter(a => a.alive);
    if (aliveAsteroids.length < ASTEROID_COUNT * 0.7) {
      this._spawnAsteroid();
    }

    // Replenish enemies
    const aliveEnemies = this.enemies.filter(e => e.alive);
    if (aliveEnemies.length < ENEMY_COUNT * 0.5 && this.frameCount % 300 === 0) {
      // Spawned via respawn timers
    }

    // World boundary — push entities back
    this._enforceWorldBounds();
  }

  _respawnEnemy(index) {
    const enemy = this.enemies[index];
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(600, WORLD_SIZE / 2 - 200);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    // Restore blocks
    enemy.blocks = enemy.blocks.map(b => new Block(b.type, b.gridX, b.gridY));
    enemy._recalculate();
    enemy.respawn(x, y);
    enemy.body.angle = Math.random() * Math.PI * 2;

    this.aiControllers[index].state = AI_STATE.PATROL;
    this.aiControllers[index].patrolCenter = new Vec2(x, y);
  }

  _updateAsteroids(dt) {
    for (const asteroid of this.asteroids) {
      if (!asteroid.alive) continue;
      asteroid.update(dt);

      // Wrap asteroids at world edge
      const half = WORLD_SIZE / 2;
      if (asteroid.x > half) asteroid.x = -half;
      if (asteroid.x < -half) asteroid.x = half;
      if (asteroid.y > half) asteroid.y = -half;
      if (asteroid.y < -half) asteroid.y = half;

      // Collision with projectiles
      for (const proj of this.weapons.projectiles) {
        if (!proj.alive) continue;
        if (asteroid.checkCollision(proj.x, proj.y)) {
          asteroid.takeDamage(proj.config.damage * 0.5, this.particles);
          proj.kill();
          if (!asteroid.alive) this.score += 25;
        }
      }

      // Collision with player
      if (this.player.alive && asteroid.checkCollision(this.player.body.pos.x, this.player.body.pos.y)) {
        this._handleShipAsteroidCollision(this.player, asteroid, dt);
      }

      // Collision with enemies
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (asteroid.checkCollision(enemy.body.pos.x, enemy.body.pos.y)) {
          this._handleShipAsteroidCollision(enemy, asteroid, dt);
        }
      }
    }
  }

  _handleShipAsteroidCollision(ship, asteroid, dt) {
    // Push apart
    const dx = ship.body.pos.x - asteroid.x;
    const dy = ship.body.pos.y - asteroid.y;
    const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = (ship.radius + asteroid.radius) - dist;
    if (overlap > 0) {
      ship.body.pos.x += nx * overlap * 0.5;
      ship.body.pos.y += ny * overlap * 0.5;
      asteroid.x -= nx * overlap * 0.5;
      asteroid.y -= ny * overlap * 0.5;

      // Damage
      const speed = ship.body.speed;
      if (speed > 50) {
        const dmg = speed * 0.02 * dt * 60;
        // Find closest block and damage it
        if (ship.blocks.length > 0) {
          const frontBlock = ship.blocks[0];
          if (frontBlock && !frontBlock.isDestroyed) {
            frontBlock.takeDamage(dmg);
            this.particles.blockExplosion(ship.body.pos.x, ship.body.pos.y, frontBlock.type);
          }
        }
        // Bounce
        ship.body.vel.x = nx * Math.abs(ship.body.vel.x) * 0.5;
        ship.body.vel.y = ny * Math.abs(ship.body.vel.y) * 0.5;
        if (ship.isPlayer) this.camera.addShake(speed * 0.05);
      }
    }
  }

  _enforceWorldBounds() {
    const half = WORLD_SIZE / 2;
    const pushForce = 500;

    const pushBack = (ship) => {
      if (!ship.alive) return;
      const { pos, vel } = ship.body;
      if (pos.x > half) { vel.x -= pushForce * 0.05; if (pos.x > half + 100) pos.x = half + 100; }
      if (pos.x < -half) { vel.x += pushForce * 0.05; if (pos.x < -half - 100) pos.x = -half - 100; }
      if (pos.y > half) { vel.y -= pushForce * 0.05; if (pos.y > half + 100) pos.y = half + 100; }
      if (pos.y < -half) { vel.y += pushForce * 0.05; if (pos.y < -half - 100) pos.y = -half - 100; }
    };

    if (this.player) pushBack(this.player);
    for (const e of this.enemies) pushBack(e);
  }

  // ── DRAW ─────────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.gameCtx;
    const w = this.gameCanvas.width;
    const h = this.gameCanvas.height;

    // Clear
    ctx.fillStyle = '#000005';
    ctx.fillRect(0, 0, w, h);

    // Stars (before camera transform, screen-space parallax)
    this.starField.draw(ctx, this.camera.x, this.camera.y, this.camera.zoom, w, h);

    this.camera.begin(ctx);

    // World boundary
    this._drawWorldBoundary(ctx);

    // Asteroids
    for (const asteroid of this.asteroids) {
      if (!asteroid.alive) continue;
      if (this.camera.isVisible(asteroid.x, asteroid.y, asteroid.radius)) {
        asteroid.draw(ctx);
      }
    }

    // Particles (behind ships)
    this.particles.draw(ctx);

    // Enemy ships
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (this.camera.isVisible(enemy.body.pos.x, enemy.body.pos.y, enemy.radius + 20)) {
        enemy.draw(ctx, this.particles, false);
      }
    }

    // Player ship
    if (this.player && this.player.alive) {
      this.player.draw(ctx, this.particles, true);
    }

    // Projectiles
    this.weapons.draw(ctx);

    // Laser beam visual (while holding space)
    if (this.player && this.player.alive && this.input.fire && !this.chat.isOpen) {
      this._drawDrillBeam(ctx, this.player);
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const ai = this.aiControllers[i];
      if (ai && ai._virtualInput.fire && this.enemies[i].alive) {
        this._drawDrillBeam(ctx, this.enemies[i]);
      }
    }

    this.camera.end(ctx);

    // Screen-space HUD elements drawn by DOM, minimap by canvas
  }

  _drawWorldBoundary(ctx) {
    const half = WORLD_SIZE / 2;
    ctx.strokeStyle = 'rgba(40,80,200,0.2)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.strokeRect(-half, -half, WORLD_SIZE, WORLD_SIZE);
    ctx.setLineDash([]);

    // Warning zone near edge
    const warnGrad = ctx.createLinearGradient(-half, 0, -half + 200, 0);
    warnGrad.addColorStop(0, 'rgba(255,60,0,0.15)');
    warnGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = warnGrad;
    ctx.fillRect(-half, -half, 200, WORLD_SIZE);

    const warnGrad2 = ctx.createLinearGradient(half, 0, half - 200, 0);
    warnGrad2.addColorStop(0, 'rgba(255,60,0,0.15)');
    warnGrad2.addColorStop(1, 'transparent');
    ctx.fillStyle = warnGrad2;
    ctx.fillRect(half - 200, -half, 200, WORLD_SIZE);
  }

  _drawDrillBeam(ctx, ship) {
    const drillBlocks = ship.getBlocksByType('DRILL');
    if (drillBlocks.length === 0) return;

    for (const db of drillBlocks) {
      const wp = ship.body.localToWorld(
        db.gridX * BLOCK_SIZE + BLOCK_SIZE / 2 - ship.comOffsetX,
        db.gridY * BLOCK_SIZE + BLOCK_SIZE / 2 - ship.comOffsetY
      );

      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
      ctx.strokeStyle = '#d0a020';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wp.x, wp.y);
      const beamEnd = ship.body.localToWorld(
        db.gridX * BLOCK_SIZE + BLOCK_SIZE / 2 - ship.comOffsetX,
        db.gridY * BLOCK_SIZE + BLOCK_SIZE / 2 - ship.comOffsetY - 48
      );
      ctx.lineTo(beamEnd.x, beamEnd.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Bootstrap on load
window.addEventListener('load', () => {
  window._game = new Game();
});
