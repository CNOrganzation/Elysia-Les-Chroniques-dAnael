import { useEffect, useRef, useCallback, useState } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────
const TILE_SIZE = 40;
const MAP_COLS = 40;
const MAP_ROWS = 40;
const PLAYER_SIZE = 28;
const ENEMY_SIZE = 26;
const BOSS_SIZE = 52;
const PLAYER_SPEED = 3.2;
const BOSS_ZONE_START_COL = 28;

// ─── Tile types ────────────────────────────────────────────────────────────
const T = {
  GRASS: 0,
  WATER: 1,
  STONE: 2,
  WALL: 3,
  FOREST: 4,
  SAND: 5,
  DUNGEON: 6,
  BOSS_FLOOR: 7,
} as const;

// Tile colors
const TILE_COLORS: Record<number, { fill: string; stroke: string }> = {
  [T.GRASS]:     { fill: "#2d5a1b", stroke: "#3a7023" },
  [T.WATER]:     { fill: "#1a4a6e", stroke: "#215c88" },
  [T.STONE]:     { fill: "#5a5a5a", stroke: "#6e6e6e" },
  [T.WALL]:      { fill: "#3a3028", stroke: "#2a2018" },
  [T.FOREST]:    { fill: "#1a3d0f", stroke: "#254d17" },
  [T.SAND]:      { fill: "#9e8840", stroke: "#b89e50" },
  [T.DUNGEON]:   { fill: "#2a2030", stroke: "#3a2d44" },
  [T.BOSS_FLOOR]:{ fill: "#3d1010", stroke: "#5a1818" },
};

// ─── Map generation ────────────────────────────────────────────────────────
function generateMap(): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        map[r][c] = T.WALL;
      } else if (c >= BOSS_ZONE_START_COL) {
        map[r][c] = T.BOSS_FLOOR;
      } else if (c >= BOSS_ZONE_START_COL - 3 && c < BOSS_ZONE_START_COL) {
        map[r][c] = T.DUNGEON;
      } else if (c >= 20 && c < BOSS_ZONE_START_COL - 3) {
        map[r][c] = Math.random() < 0.15 ? T.STONE : T.DUNGEON;
      } else if (c >= 14 && c < 20) {
        map[r][c] = Math.random() < 0.2 ? T.STONE : T.SAND;
      } else if (c >= 8 && c < 14) {
        if ((r >= 5 && r <= 8) || (r >= 18 && r <= 22)) map[r][c] = T.WATER;
        else map[r][c] = T.GRASS;
      } else {
        const rnd = Math.random();
        if (rnd < 0.08) map[r][c] = T.FOREST;
        else if (rnd < 0.05) map[r][c] = T.STONE;
        else map[r][c] = T.GRASS;
      }
    }
  }
  // Boss room separator wall
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    if (r < 14 || r > 26) map[r][BOSS_ZONE_START_COL - 1] = T.WALL;
  }
  return map;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface Entity {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}
interface Enemy extends Entity {
  type: "goblin" | "skeleton" | "orc";
  vx: number;
  vy: number;
  aggroRange: number;
  attackTimer: number;
  color: string;
}
interface Boss extends Entity {
  phase: 1 | 2;
  vx: number;
  vy: number;
  attackTimer: number;
  enraged: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// ─── GameState ─────────────────────────────────────────────────────────────
interface GameState {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    xp: number;
    xpNext: number;
    level: number;
    attack: number;
    facing: "up" | "down" | "left" | "right";
    attackTimer: number;
    invincible: number;
    skillCooldown: number;
  };
  enemies: Enemy[];
  boss: Boss | null;
  particles: Particle[];
  map: number[][];
  camera: { x: number; y: number };
  kills: number;
  gamePhase: "explore" | "boss" | "victory" | "dead";
  bossTriggered: boolean;
  floatingTexts: { x: number; y: number; text: string; color: string; life: number }[];
}

// ─── Input ─────────────────────────────────────────────────────────────────
interface InputState {
  dx: number;
  dy: number;
  attack: boolean;
  skill: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function spawnEnemies(): Enemy[] {
  const types: Enemy["type"][] = ["goblin", "skeleton", "orc"];
  const colors = { goblin: "#5d9e4a", skeleton: "#c8c8b0", orc: "#7a5a32" };
  const enemies: Enemy[] = [];
  let id = 1;
  for (let i = 0; i < 18; i++) {
    const t = types[Math.floor(Math.random() * 3)];
    const col = 4 + Math.floor(Math.random() * 22);
    const row = 2 + Math.floor(Math.random() * (MAP_ROWS - 4));
    enemies.push({
      id: id++,
      type: t,
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
      hp: t === "orc" ? 80 : t === "skeleton" ? 50 : 30,
      maxHp: t === "orc" ? 80 : t === "skeleton" ? 50 : 30,
      vx: 0,
      vy: 0,
      dead: false,
      aggroRange: t === "orc" ? 200 : t === "skeleton" ? 180 : 160,
      attackTimer: 0,
      color: colors[t],
    });
  }
  return enemies;
}

function spawnBoss(): Boss {
  return {
    id: 9999,
    x: (BOSS_ZONE_START_COL + 5) * TILE_SIZE,
    y: MAP_ROWS / 2 * TILE_SIZE,
    hp: 500,
    maxHp: 500,
    vx: 0,
    vy: 0,
    dead: false,
    phase: 1,
    attackTimer: 0,
    enraged: false,
  };
}

function isSolid(map: number[][], px: number, py: number): boolean {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true;
  const t = map[row][col];
  return t === T.WALL || t === T.FOREST || t === T.WATER;
}

function canMoveTo(map: number[][], cx: number, cy: number, size: number): boolean {
  const half = size / 2 - 2;
  return (
    !isSolid(map, cx - half, cy - half) &&
    !isSolid(map, cx + half, cy - half) &&
    !isSolid(map, cx - half, cy + half) &&
    !isSolid(map, cx + half, cy + half)
  );
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count = 6
) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

function initState(): GameState {
  const map = generateMap();
  return {
    player: {
      x: 3 * TILE_SIZE,
      y: MAP_ROWS / 2 * TILE_SIZE,
      hp: 100,
      maxHp: 100,
      mp: 60,
      maxMp: 60,
      xp: 0,
      xpNext: 100,
      level: 1,
      attack: 18,
      facing: "right",
      attackTimer: 0,
      invincible: 0,
      skillCooldown: 0,
    },
    enemies: spawnEnemies(),
    boss: null,
    particles: [],
    map,
    camera: { x: 0, y: 0 },
    kills: 0,
    gamePhase: "explore",
    bossTriggered: false,
    floatingTexts: [],
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState());
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, attack: false, skill: false });
  const rafRef = useRef<number>(0);
  const [hud, setHud] = useState({
    hp: 100, maxHp: 100,
    mp: 60, maxMp: 60,
    xp: 0, xpNext: 100,
    level: 1, kills: 0,
    bossHp: 0, bossMaxHp: 500,
    gamePhase: "explore" as GameState["gamePhase"],
    skillCooldown: 0,
    skillMaxCooldown: 120,
  });

  // ─── Touch D-pad ───────────────────────────────────────────────────────
  const joystickOriginRef = useRef<{ x: number; y: number } | null>(null);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dpadRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (target.dataset.action === "attack") {
        inputRef.current.attack = true;
        return;
      }
      if (target.dataset.action === "skill") {
        inputRef.current.skill = true;
        return;
      }
      // Left half = joystick
      if (touch.clientX < window.innerWidth / 2) {
        if (joystickTouchIdRef.current === null) {
          joystickTouchIdRef.current = touch.identifier;
          joystickOriginRef.current = { x: touch.clientX, y: touch.clientY };
          joystickPosRef.current = { x: 0, y: 0 };
        }
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current && joystickOriginRef.current) {
        const dx = touch.clientX - joystickOriginRef.current.x;
        const dy = touch.clientY - joystickOriginRef.current.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const maxR = 50;
        if (len > 0) {
          const nx = dx / len;
          const ny = dy / len;
          const clamped = Math.min(len, maxR);
          joystickPosRef.current = { x: nx * clamped, y: ny * clamped };
          inputRef.current.dx = nx * Math.min(len / maxR, 1);
          inputRef.current.dy = ny * Math.min(len / maxR, 1);
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (target.dataset.action === "attack") { inputRef.current.attack = false; return; }
      if (target.dataset.action === "skill") { inputRef.current.skill = false; return; }
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        joystickOriginRef.current = null;
        joystickPosRef.current = { x: 0, y: 0 };
        inputRef.current.dx = 0;
        inputRef.current.dy = 0;
      }
    }
  }, []);

  // ─── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key);
      let dx = 0, dy = 0;
      if (keys.has("ArrowLeft") || keys.has("a")) dx = -1;
      if (keys.has("ArrowRight") || keys.has("d")) dx = 1;
      if (keys.has("ArrowUp") || keys.has("w")) dy = -1;
      if (keys.has("ArrowDown") || keys.has("s")) dy = 1;
      inputRef.current.dx = dx;
      inputRef.current.dy = dy;
      if (e.key === " " || e.key === "z") inputRef.current.attack = true;
      if (e.key === "x" || e.key === "q") inputRef.current.skill = true;
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
      let dx = 0, dy = 0;
      if (keys.has("ArrowLeft") || keys.has("a")) dx = -1;
      if (keys.has("ArrowRight") || keys.has("d")) dx = 1;
      if (keys.has("ArrowUp") || keys.has("w")) dy = -1;
      if (keys.has("ArrowDown") || keys.has("s")) dy = 1;
      inputRef.current.dx = dx;
      inputRef.current.dy = dy;
      if (e.key === " " || e.key === "z") inputRef.current.attack = false;
      if (e.key === "x" || e.key === "q") inputRef.current.skill = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // ─── Game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const s = stateRef.current;
      const inp = inputRef.current;
      const W = canvas.width;
      const H = canvas.height;

      if (s.gamePhase === "dead" || s.gamePhase === "victory") {
        drawEndScreen(ctx, W, H, s);
        return;
      }

      // ── Update player ──────────────────────────────────────────────
      const p = s.player;
      if (p.attackTimer > 0) p.attackTimer--;
      if (p.invincible > 0) p.invincible--;
      if (p.skillCooldown > 0) p.skillCooldown--;

      const len = Math.sqrt(inp.dx * inp.dx + inp.dy * inp.dy);
      if (len > 0) {
        const nx = inp.dx / len;
        const ny = inp.dy / len;
        const nx2 = nx * PLAYER_SPEED;
        const ny2 = ny * PLAYER_SPEED;
        if (canMoveTo(s.map, p.x + nx2, p.y, PLAYER_SIZE)) p.x += nx2;
        if (canMoveTo(s.map, p.x, p.y + ny2, PLAYER_SIZE)) p.y += ny2;
        if (Math.abs(nx) > Math.abs(ny)) p.facing = nx > 0 ? "right" : "left";
        else p.facing = ny > 0 ? "down" : "up";
      }

      // Clamp player
      p.x = Math.max(PLAYER_SIZE / 2, Math.min(MAP_COLS * TILE_SIZE - PLAYER_SIZE / 2, p.x));
      p.y = Math.max(PLAYER_SIZE / 2, Math.min(MAP_ROWS * TILE_SIZE - PLAYER_SIZE / 2, p.y));

      // MP regen
      if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + 0.05);

      // Boss trigger
      if (!s.bossTriggered && p.x > BOSS_ZONE_START_COL * TILE_SIZE) {
        s.bossTriggered = true;
        s.boss = spawnBoss();
        s.gamePhase = "boss";
      }

      // ── Attack ─────────────────────────────────────────────────────
      const ATTACK_RANGE = 55;
      const ATTACK_COOLDOWN = 22;
      if (inp.attack && p.attackTimer === 0) {
        p.attackTimer = ATTACK_COOLDOWN;
        // Hit enemies
        s.enemies.forEach(en => {
          if (en.dead) return;
          const d = distance(p.x, p.y, en.x, en.y);
          if (d < ATTACK_RANGE + ENEMY_SIZE / 2) {
            en.hp -= p.attack;
            spawnParticles(s.particles, en.x, en.y, "#ff4444", 5);
            s.floatingTexts.push({ x: en.x, y: en.y - 20, text: `-${p.attack}`, color: "#ff6666", life: 45 });
            if (en.hp <= 0) {
              en.dead = true;
              s.kills++;
              p.xp += en.type === "orc" ? 35 : en.type === "skeleton" ? 20 : 12;
              spawnParticles(s.particles, en.x, en.y, "#ffd700", 10);
              if (p.xp >= p.xpNext) {
                p.xp -= p.xpNext;
                p.level++;
                p.xpNext = Math.floor(p.xpNext * 1.4);
                p.maxHp += 15;
                p.hp = Math.min(p.hp + 20, p.maxHp);
                p.maxMp += 8;
                p.attack += 5;
                s.floatingTexts.push({ x: p.x, y: p.y - 50, text: "NIVEAU +", color: "#ffd700", life: 90 });
              }
            }
          }
        });
        // Hit boss
        if (s.boss && !s.boss.dead) {
          const d = distance(p.x, p.y, s.boss.x, s.boss.y);
          if (d < ATTACK_RANGE + BOSS_SIZE / 2) {
            const dmg = p.attack;
            s.boss.hp -= dmg;
            spawnParticles(s.particles, s.boss.x, s.boss.y, "#ff2200", 8);
            s.floatingTexts.push({ x: s.boss.x + (Math.random() - 0.5) * 40, y: s.boss.y - 30, text: `-${dmg}`, color: "#ff4444", life: 50 });
            if (s.boss.hp <= 0) {
              s.boss.dead = true;
              s.gamePhase = "victory";
              spawnParticles(s.particles, s.boss.x, s.boss.y, "#ffd700", 40);
            }
            if (s.boss.hp < s.boss.maxHp * 0.4 && !s.boss.enraged) {
              s.boss.enraged = true;
              s.boss.phase = 2;
              s.floatingTexts.push({ x: s.boss.x, y: s.boss.y - 80, text: "ENRAGÉ!", color: "#ff0000", life: 90 });
            }
          }
        }
      }

      // ── Skill ──────────────────────────────────────────────────────
      const SKILL_COOLDOWN = 120;
      if (inp.skill && p.skillCooldown === 0 && p.mp >= 20) {
        p.skillCooldown = SKILL_COOLDOWN;
        p.mp -= 20;
        const SKILL_RANGE = 110;
        s.enemies.forEach(en => {
          if (en.dead) return;
          const d = distance(p.x, p.y, en.x, en.y);
          if (d < SKILL_RANGE) {
            const dmg = Math.floor(p.attack * 1.8);
            en.hp -= dmg;
            spawnParticles(s.particles, en.x, en.y, "#a060ff", 8);
            s.floatingTexts.push({ x: en.x, y: en.y - 20, text: `-${dmg}`, color: "#cc88ff", life: 45 });
            if (en.hp <= 0) { en.dead = true; s.kills++; p.xp += 20; }
          }
        });
        if (s.boss && !s.boss.dead) {
          const d = distance(p.x, p.y, s.boss.x, s.boss.y);
          if (d < SKILL_RANGE) {
            const dmg = Math.floor(p.attack * 2);
            s.boss.hp -= dmg;
            spawnParticles(s.particles, s.boss.x, s.boss.y, "#a060ff", 12);
            s.floatingTexts.push({ x: s.boss.x, y: s.boss.y - 40, text: `-${dmg} MAGIE`, color: "#cc88ff", life: 60 });
            if (s.boss.hp <= 0) { s.boss.dead = true; s.gamePhase = "victory"; }
          }
        }
        spawnParticles(s.particles, p.x, p.y, "#8844ff", 14);
      }

      // ── Enemy AI ───────────────────────────────────────────────────
      s.enemies.forEach(en => {
        if (en.dead) return;
        const d = distance(p.x, p.y, en.x, en.y);
        if (d < en.aggroRange) {
          const dx2 = p.x - en.x;
          const dy2 = p.y - en.y;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (len2 > 0) {
            const speed = en.type === "orc" ? 1.0 : en.type === "skeleton" ? 1.3 : 1.6;
            en.vx = (dx2 / len2) * speed;
            en.vy = (dy2 / len2) * speed;
          }
        } else {
          en.vx *= 0.9;
          en.vy *= 0.9;
        }
        if (canMoveTo(s.map, en.x + en.vx, en.y, ENEMY_SIZE)) en.x += en.vx;
        if (canMoveTo(s.map, en.x, en.y + en.vy, ENEMY_SIZE)) en.y += en.vy;

        // Enemy attack
        if (d < 32 && en.attackTimer === 0 && p.invincible === 0) {
          const dmg = en.type === "orc" ? 12 : en.type === "skeleton" ? 8 : 5;
          p.hp -= dmg;
          p.invincible = 35;
          en.attackTimer = 55;
          spawnParticles(s.particles, p.x, p.y, "#ff0000", 6);
          s.floatingTexts.push({ x: p.x, y: p.y - 40, text: `-${dmg}`, color: "#ff4444", life: 45 });
          if (p.hp <= 0) { p.hp = 0; s.gamePhase = "dead"; }
        }
        if (en.attackTimer > 0) en.attackTimer--;
      });

      // ── Boss AI ────────────────────────────────────────────────────
      if (s.boss && !s.boss.dead) {
        const b = s.boss;
        const d = distance(p.x, p.y, b.x, b.y);
        const speed = b.enraged ? 2.2 : 1.4;
        if (d > 50) {
          const dx2 = p.x - b.x;
          const dy2 = p.y - b.y;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          b.vx = (dx2 / len2) * speed;
          b.vy = (dy2 / len2) * speed;
        } else {
          b.vx *= 0.8;
          b.vy *= 0.8;
        }
        if (canMoveTo(s.map, b.x + b.vx, b.y, BOSS_SIZE)) b.x += b.vx;
        if (canMoveTo(s.map, b.x, b.y + b.vy, BOSS_SIZE)) b.y += b.vy;

        const cooldown = b.enraged ? 60 : 90;
        if (d < BOSS_SIZE && b.attackTimer === 0 && p.invincible === 0) {
          const dmg = b.enraged ? 22 : 15;
          p.hp -= dmg;
          p.invincible = 30;
          b.attackTimer = cooldown;
          spawnParticles(s.particles, p.x, p.y, "#ff0000", 8);
          s.floatingTexts.push({ x: p.x, y: p.y - 50, text: `-${dmg}`, color: "#ff2222", life: 55 });
          if (p.hp <= 0) { p.hp = 0; s.gamePhase = "dead"; }
        }
        if (b.attackTimer > 0) b.attackTimer--;
      }

      // ── Particles ──────────────────────────────────────────────────
      s.particles = s.particles.filter(pt => pt.life > 0);
      s.particles.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.life--;
      });

      s.floatingTexts = s.floatingTexts.filter(ft => ft.life > 0);
      s.floatingTexts.forEach(ft => { ft.y -= 0.5; ft.life--; });

      // ── Camera ─────────────────────────────────────────────────────
      s.camera.x = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - W, p.x - W / 2));
      s.camera.y = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - H, p.y - H / 2));

      // ── Render ─────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(-s.camera.x, -s.camera.y);

      // Visible tiles
      const startCol = Math.max(0, Math.floor(s.camera.x / TILE_SIZE));
      const endCol = Math.min(MAP_COLS - 1, Math.ceil((s.camera.x + W) / TILE_SIZE));
      const startRow = Math.max(0, Math.floor(s.camera.y / TILE_SIZE));
      const endRow = Math.min(MAP_ROWS - 1, Math.ceil((s.camera.y + H) / TILE_SIZE));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = s.map[r][c];
          const tc = TILE_COLORS[tile];
          ctx.fillStyle = tc.fill;
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = tc.stroke;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          // Tile decorations
          if (tile === T.GRASS && Math.sin(r * 31 + c * 17) > 0.6) {
            ctx.fillStyle = "#3a7023";
            ctx.fillRect(c * TILE_SIZE + 8, r * TILE_SIZE + 14, 3, 10);
            ctx.fillRect(c * TILE_SIZE + 18, r * TILE_SIZE + 10, 3, 12);
            ctx.fillRect(c * TILE_SIZE + 28, r * TILE_SIZE + 16, 3, 8);
          }
          if (tile === T.FOREST) {
            ctx.fillStyle = "#0d2a07";
            ctx.beginPath();
            ctx.arc(c * TILE_SIZE + 20, r * TILE_SIZE + 20, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1d4d0f";
            ctx.beginPath();
            ctx.arc(c * TILE_SIZE + 20, r * TILE_SIZE + 18, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Enemies
      s.enemies.forEach(en => {
        if (en.dead) return;
        const ex = en.x, ey = en.y;
        if (ex + ENEMY_SIZE < s.camera.x || ex - ENEMY_SIZE > s.camera.x + W) return;
        if (ey + ENEMY_SIZE < s.camera.y || ey - ENEMY_SIZE > s.camera.y + H) return;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(ex, ey + ENEMY_SIZE / 2 - 2, ENEMY_SIZE / 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = en.color;
        ctx.beginPath();
        ctx.arc(ex, ey, ENEMY_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath();
        ctx.arc(ex - 4, ey - 2, 3, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff3300";
        ctx.beginPath();
        ctx.arc(ex - 4, ey - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // HP bar
        const bw = 30, bh = 5;
        const bx = ex - bw / 2, by = ey - ENEMY_SIZE / 2 - 10;
        ctx.fillStyle = "#300";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = "#e33";
        ctx.fillRect(bx, by, bw * (en.hp / en.maxHp), bh);

        // Type label
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(ex - 18, ey - ENEMY_SIZE / 2 - 22, 36, 11);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px Arial";
        ctx.textAlign = "center";
        ctx.fillText(en.type.toUpperCase(), ex, ey - ENEMY_SIZE / 2 - 13);
      });

      // Boss
      if (s.boss && !s.boss.dead) {
        const b = s.boss;
        const anim = Math.sin(Date.now() / 200) * 4;

        // Glow aura
        const grad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, BOSS_SIZE + 20);
        grad.addColorStop(0, b.enraged ? "rgba(255,50,0,0.5)" : "rgba(150,0,200,0.4)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BOSS_SIZE + 20, 0, Math.PI * 2);
        ctx.fill();

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y + BOSS_SIZE / 2, BOSS_SIZE / 2 + 5, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = b.enraged ? "#6a0000" : "#3a0060";
        ctx.beginPath();
        ctx.arc(b.x, b.y + anim, BOSS_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        // Armor plates
        ctx.fillStyle = b.enraged ? "#8b0000" : "#5a0090";
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Date.now() / 2000;
          ctx.beginPath();
          ctx.arc(
            b.x + Math.cos(ang) * (BOSS_SIZE / 2 - 8),
            b.y + anim + Math.sin(ang) * (BOSS_SIZE / 2 - 8),
            6, 0, Math.PI * 2
          );
          ctx.fill();
        }

        // Crown / horns
        ctx.fillStyle = b.enraged ? "#ff4400" : "#9900cc";
        ctx.beginPath();
        ctx.moveTo(b.x - 16, b.y + anim - BOSS_SIZE / 2 + 4);
        ctx.lineTo(b.x - 10, b.y + anim - BOSS_SIZE / 2 - 14);
        ctx.lineTo(b.x - 4, b.y + anim - BOSS_SIZE / 2 + 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.x + 4, b.y + anim - BOSS_SIZE / 2 + 2);
        ctx.lineTo(b.x + 10, b.y + anim - BOSS_SIZE / 2 - 14);
        ctx.lineTo(b.x + 16, b.y + anim - BOSS_SIZE / 2 + 4);
        ctx.fill();

        // Eyes (large, glowing)
        ctx.fillStyle = b.enraged ? "#ff8800" : "#cc00ff";
        ctx.beginPath();
        ctx.arc(b.x - 8, b.y + anim - 6, 6, 0, Math.PI * 2);
        ctx.arc(b.x + 8, b.y + anim - 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x - 8, b.y + anim - 6, 2.5, 0, Math.PI * 2);
        ctx.arc(b.x + 8, b.y + anim - 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // BOSS label
        const labelY = b.y + anim - BOSS_SIZE / 2 - 30;
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(b.x - 44, labelY - 14, 88, 18);
        ctx.fillStyle = b.enraged ? "#ff4400" : "#cc00ff";
        ctx.fillText(b.enraged ? "SEIGNEUR OBLIVION ★" : "SEIGNEUR OBLIVION", b.x, labelY);
      }

      // Player
      {
        const px = p.x, py = p.y;
        const alpha = p.invincible > 0 ? (Math.floor(p.invincible / 4) % 2 === 0 ? 0.4 : 1.0) : 1.0;
        ctx.globalAlpha = alpha;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(px, py + PLAYER_SIZE / 2 - 2, PLAYER_SIZE / 2 - 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cape
        ctx.fillStyle = "#1a3a8a";
        ctx.beginPath();
        if (p.facing === "right") {
          ctx.moveTo(px - 8, py - PLAYER_SIZE / 2 + 4);
          ctx.lineTo(px - 14, py + PLAYER_SIZE / 2);
          ctx.lineTo(px + 2, py + PLAYER_SIZE / 2);
        } else if (p.facing === "left") {
          ctx.moveTo(px + 8, py - PLAYER_SIZE / 2 + 4);
          ctx.lineTo(px + 14, py + PLAYER_SIZE / 2);
          ctx.lineTo(px - 2, py + PLAYER_SIZE / 2);
        } else {
          ctx.moveTo(px - 10, py - PLAYER_SIZE / 2 + 4);
          ctx.lineTo(px - 14, py + PLAYER_SIZE / 2 + 4);
          ctx.lineTo(px + 14, py + PLAYER_SIZE / 2 + 4);
          ctx.lineTo(px + 10, py - PLAYER_SIZE / 2 + 4);
        }
        ctx.fill();

        // Body
        ctx.fillStyle = "#c0a050";
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#a08038";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Chest emblem
        ctx.fillStyle = "#4a90e2";
        ctx.beginPath();
        ctx.arc(px, py + 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 7px Arial";
        ctx.textAlign = "center";
        ctx.fillText("✦", px, py + 5);

        // Helmet/head
        ctx.fillStyle = "#e8c87a";
        ctx.beginPath();
        ctx.arc(px, py - PLAYER_SIZE / 2 + 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#a08038";
        ctx.fillRect(px - 9, py - PLAYER_SIZE / 2 - 2, 18, 5);

        // Weapon
        if (p.attackTimer > ATTACK_COOLDOWN * 0.5) {
          const angle = p.facing === "right" ? 0.4 : p.facing === "left" ? Math.PI - 0.4 : p.facing === "down" ? Math.PI / 2 : -Math.PI / 2;
          ctx.strokeStyle = "#e8e8e8";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(angle) * 10, py + Math.sin(angle) * 10);
          ctx.lineTo(px + Math.cos(angle) * 42, py + Math.sin(angle) * 42);
          ctx.stroke();
          ctx.fillStyle = "#ffd700";
          ctx.beginPath();
          ctx.arc(px + Math.cos(angle) * 42, py + Math.sin(angle) * 42, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1.0;
      }

      // Particles
      s.particles.forEach(pt => {
        if (pt.life <= 0) return;
        const alpha2 = Math.max(0, pt.life / pt.maxLife);
        if (alpha2 <= 0) return;
        ctx.globalAlpha = alpha2;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.1, pt.size * alpha2), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Floating texts
      s.floatingTexts.forEach(ft => {
        const alpha2 = ft.life / 45;
        ctx.globalAlpha = Math.min(1, alpha2);
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // Update HUD state every 3 frames for performance
      if (rafRef.current % 3 === 0) {
        setHud({
          hp: Math.max(0, s.player.hp),
          maxHp: s.player.maxHp,
          mp: s.player.mp,
          maxMp: s.player.maxMp,
          xp: s.player.xp,
          xpNext: s.player.xpNext,
          level: s.player.level,
          kills: s.kills,
          bossHp: s.boss ? Math.max(0, s.boss.hp) : 0,
          bossMaxHp: s.boss ? s.boss.maxHp : 500,
          gamePhase: s.gamePhase,
          skillCooldown: s.player.skillCooldown,
          skillMaxCooldown: 120,
        });
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const restart = useCallback(() => {
    stateRef.current = initState();
  }, []);

  // Joystick knob position
  const knobX = joystickPosRef.current.x;
  const knobY = joystickPosRef.current.y;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "#0a0a12",
        overflow: "hidden",
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      {/* ── HUD ─────────────────────────────────────────────────── */}
      {hud.gamePhase !== "dead" && hud.gamePhase !== "victory" && (
        <>
          {/* Top-left info panel */}
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,215,0,0.4)",
            borderRadius: 10,
            padding: "8px 12px",
            minWidth: 140,
            backdropFilter: "blur(4px)",
          }}>
            <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
              ARANEL — Niv. {hud.level}
            </div>
            {/* HP */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ color: "#ff6666", fontSize: 10, width: 20 }}>❤️</span>
              <div style={{ flex: 1, background: "#300", borderRadius: 3, height: 8 }}>
                <div style={{
                  width: `${(hud.hp / hud.maxHp) * 100}%`,
                  background: hud.hp < hud.maxHp * 0.25 ? "#ff2200" : "#e33",
                  height: "100%", borderRadius: 3,
                  transition: "width 0.1s"
                }} />
              </div>
              <span style={{ color: "#ff9999", fontSize: 9, minWidth: 40 }}>{Math.ceil(hud.hp)}/{hud.maxHp}</span>
            </div>
            {/* MP */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ color: "#6699ff", fontSize: 10, width: 20 }}>✨</span>
              <div style={{ flex: 1, background: "#003", borderRadius: 3, height: 8 }}>
                <div style={{
                  width: `${(hud.mp / hud.maxMp) * 100}%`,
                  background: "#44f",
                  height: "100%", borderRadius: 3,
                  transition: "width 0.1s"
                }} />
              </div>
              <span style={{ color: "#aabbff", fontSize: 9, minWidth: 40 }}>{Math.floor(hud.mp)}/{hud.maxMp}</span>
            </div>
            {/* XP */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#ffd700", fontSize: 10, width: 20 }}>⭐</span>
              <div style={{ flex: 1, background: "#220", borderRadius: 3, height: 6 }}>
                <div style={{
                  width: `${(hud.xp / hud.xpNext) * 100}%`,
                  background: "#ffd700",
                  height: "100%", borderRadius: 3
                }} />
              </div>
              <span style={{ color: "#ffdd88", fontSize: 9, minWidth: 40 }}>{hud.xp}/{hud.xpNext}</span>
            </div>
          </div>

          {/* Kills counter - top right */}
          <div style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,100,0,0.4)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "#ff8844",
            fontWeight: "bold",
            fontSize: 12,
            textAlign: "center",
          }}>
            ⚔️ {hud.kills}
          </div>

          {/* Boss HP bar */}
          {hud.gamePhase === "boss" && hud.bossHp > 0 && (
            <div style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(320px, 65vw)",
              background: "rgba(0,0,0,0.8)",
              border: "2px solid #880000",
              borderRadius: 8,
              padding: "8px 12px",
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ color: "#ff4444", fontWeight: "bold", fontSize: 11, textAlign: "center", marginBottom: 5 }}>
                ☠ SEIGNEUR OBLIVION {hud.bossHp < hud.bossMaxHp * 0.4 ? "★ ENRAGÉ" : ""}
              </div>
              <div style={{ background: "#300", borderRadius: 4, height: 14, border: "1px solid #600" }}>
                <div style={{
                  width: `${(hud.bossHp / hud.bossMaxHp) * 100}%`,
                  background: hud.bossHp < hud.bossMaxHp * 0.4
                    ? "linear-gradient(90deg,#ff0000,#ff6600)"
                    : "linear-gradient(90deg,#880000,#cc0000)",
                  height: "100%", borderRadius: 4,
                  transition: "width 0.1s",
                }} />
              </div>
              <div style={{ color: "#ff8888", fontSize: 10, textAlign: "center", marginTop: 2 }}>
                {Math.max(0, hud.bossHp)} / {hud.bossMaxHp}
              </div>
            </div>
          )}

          {/* ── Touch controls ─────────────────────────────────── */}
          {/* Left: Virtual joystick base */}
          <div
            ref={dpadRef}
            style={{
              position: "absolute",
              bottom: 30,
              left: 30,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {/* Knob */}
            <div style={{
              position: "absolute",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,215,0,0.7)",
              border: "2px solid rgba(255,215,0,0.9)",
              transform: `translate(${knobX}px, ${knobY}px)`,
              transition: joystickTouchIdRef.current !== null ? "none" : "transform 0.1s",
              boxShadow: "0 0 10px rgba(255,215,0,0.5)",
            }} />
            {/* Arrows */}
            {["↑", "↓", "←", "→"].map((arrow, i) => {
              const positions = [
                { top: 4, left: "50%", transform: "translateX(-50%)" },
                { bottom: 4, left: "50%", transform: "translateX(-50%)" },
                { left: 4, top: "50%", transform: "translateY(-50%)" },
                { right: 4, top: "50%", transform: "translateY(-50%)" },
              ];
              return (
                <div key={arrow} style={{
                  position: "absolute",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 14,
                  ...positions[i],
                }}>{arrow}</div>
              );
            })}
          </div>

          {/* Right: Action buttons */}
          <div style={{
            position: "absolute",
            bottom: 30,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-end",
          }}>
            {/* Skill button */}
            <div
              data-action="skill"
              data-testid="button-skill"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: hud.skillCooldown > 0
                  ? "rgba(80,40,120,0.5)"
                  : "rgba(140,60,220,0.85)",
                border: "2px solid rgba(180,100,255,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 10,
                fontWeight: "bold",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: hud.skillCooldown > 0 ? "none" : "0 0 12px rgba(160,80,255,0.6)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {hud.skillCooldown > 0 && (
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${((hud.skillMaxCooldown - hud.skillCooldown) / hud.skillMaxCooldown) * 100}%`,
                  background: "rgba(140,60,220,0.6)",
                  transition: "height 0.05s",
                }} />
              )}
              <span style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                {hud.skillCooldown > 0 ? `${Math.ceil(hud.skillCooldown / 60 * 2)}s` : "✨\nMAGIE"}
              </span>
            </div>

            {/* Attack button */}
            <div
              data-action="attack"
              data-testid="button-attack"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(180,50,50,0.85)",
                border: "3px solid rgba(255,100,100,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 0 14px rgba(255,60,60,0.6)",
                userSelect: "none",
              }}
            >
              ⚔️<br />ATT
            </div>
          </div>

          {/* Controls hint */}
          <div style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.3)",
            fontSize: 9,
            textAlign: "center",
            pointerEvents: "none",
          }}>
            ZQSD/Flèches·Espace·X  |  Tactile: Joystick + Boutons
          </div>
        </>
      )}

      {/* ── End screen ────────────────────────────────────────── */}
      {(hud.gamePhase === "dead" || hud.gamePhase === "victory") && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: hud.gamePhase === "victory" ? "rgba(10,8,0,0.85)" : "rgba(0,0,0,0.88)",
          flexDirection: "column",
          gap: 16,
        }}>
          <div style={{
            fontSize: 36, fontWeight: "bold",
            color: hud.gamePhase === "victory" ? "#ffd700" : "#ff3333",
            textShadow: hud.gamePhase === "victory" ? "0 0 20px rgba(255,215,0,0.8)" : "0 0 20px rgba(255,50,50,0.8)",
          }}>
            {hud.gamePhase === "victory" ? "✦ VICTOIRE ✦" : "☠ DÉFAITE ☠"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center" }}>
            {hud.gamePhase === "victory"
              ? `Seigneur Oblivion vaincu ! Niv. ${hud.level} — ${hud.kills} ennemis`
              : `Aranel est tombé au niveau ${hud.level}.`}
          </div>
          <button
            data-testid="button-restart"
            onClick={restart}
            style={{
              marginTop: 12,
              padding: "12px 36px",
              background: "rgba(255,215,0,0.15)",
              border: "2px solid #ffd700",
              borderRadius: 8,
              color: "#ffd700",
              fontSize: 15,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Rejouer
          </button>
        </div>
      )}
    </div>
  );
}

function drawEndScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: GameState) {
  ctx.clearRect(0, 0, W, H);
  // Animated particles still
  ctx.save();
  ctx.translate(-s.camera.x, -s.camera.y);
  s.particles.forEach(pt => {
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}
