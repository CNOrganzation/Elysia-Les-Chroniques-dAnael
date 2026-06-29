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
const SAVE_KEY = "elysia_save_v1";

// ─── Tile types ────────────────────────────────────────────────────────────
const T = {
  GRASS: 0, WATER: 1, STONE: 2, WALL: 3,
  FOREST: 4, SAND: 5, DUNGEON: 6, BOSS_FLOOR: 7,
} as const;

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

// ─── Items ─────────────────────────────────────────────────────────────────
type ItemType = "weapon" | "armor" | "ring" | "potion" | "amulet";
type ItemRarity = "commun" | "rare" | "épique" | "légendaire";

interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  emoji: string;
  description: string;
  bonusAtk?: number;
  bonusHp?: number;
  bonusMp?: number;
  healHp?: number;
  healMp?: number;
  xpBonus?: number;
}

const ITEM_POOL: Item[] = [
  { id: "sword1",   name: "Épée courte",    type: "weapon",  rarity: "commun",    emoji: "🗡️",  description: "+8 ATT",        bonusAtk: 8  },
  { id: "sword2",   name: "Épée longue",    type: "weapon",  rarity: "rare",      emoji: "⚔️",  description: "+18 ATT",       bonusAtk: 18 },
  { id: "sword3",   name: "Épée runique",   type: "weapon",  rarity: "épique",    emoji: "🔱",  description: "+32 ATT",       bonusAtk: 32 },
  { id: "sword4",   name: "Lame d'Oblivion",type: "weapon",  rarity: "légendaire",emoji: "⚡",  description: "+50 ATT",       bonusAtk: 50 },
  { id: "armor1",   name: "Armure légère",  type: "armor",   rarity: "commun",    emoji: "🛡️",  description: "+20 HP max",    bonusHp: 20  },
  { id: "armor2",   name: "Armure lourde",  type: "armor",   rarity: "rare",      emoji: "🏛️",  description: "+45 HP max",    bonusHp: 45  },
  { id: "armor3",   name: "Armure sacrée",  type: "armor",   rarity: "épique",    emoji: "✨",  description: "+80 HP max",    bonusHp: 80  },
  { id: "ring1",    name: "Bague de mana",  type: "ring",    rarity: "commun",    emoji: "💍",  description: "+20 MP max",    bonusMp: 20  },
  { id: "ring2",    name: "Bague des arcanes",type: "ring",  rarity: "rare",      emoji: "🔮",  description: "+40 MP max",    bonusMp: 40  },
  { id: "amulet1",  name: "Amulette du héros",type:"amulet", rarity: "rare",      emoji: "📿",  description: "+12 ATT, +15 HP", bonusAtk: 12, bonusHp: 15 },
  { id: "potion1",  name: "Potion de vie",  type: "potion",  rarity: "commun",    emoji: "🧪",  description: "Restaure 40 HP", healHp: 40   },
  { id: "potion2",  name: "Grande potion",  type: "potion",  rarity: "rare",      emoji: "⚗️",  description: "Restaure 80 HP", healHp: 80   },
  { id: "potion3",  name: "Élixir de mana", type: "potion",  rarity: "commun",    emoji: "💙",  description: "Restaure 30 MP", healMp: 30   },
];

const RARITY_COLOR: Record<ItemRarity, string> = {
  commun: "#a0a0a0",
  rare: "#4a9eff",
  épique: "#cc55ff",
  légendaire: "#ff8c00",
};

function rollDrop(enemyType: string): Item | null {
  const chance = enemyType === "orc" ? 0.35 : enemyType === "skeleton" ? 0.25 : 0.15;
  if (Math.random() > chance) return null;
  const pool = enemyType === "orc"
    ? ITEM_POOL.filter(i => i.rarity !== "légendaire")
    : enemyType === "skeleton"
    ? ITEM_POOL.filter(i => i.rarity === "commun" || i.rarity === "rare")
    : ITEM_POOL.filter(i => i.rarity === "commun");
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollBossDrop(): Item[] {
  return [
    ITEM_POOL.find(i => i.id === "sword4")!,
    ITEM_POOL.find(i => i.id === "armor3")!,
  ];
}

// ─── Save / Load ────────────────────────────────────────────────────────────
interface SaveData {
  level: number;
  xp: number;
  xpNext: number;
  maxHp: number;
  maxMp: number;
  attack: number;
  kills: number;
  inventory: Item[];
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedRing: Item | null;
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch { return null; }
}

function writeSave(data: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

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
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    if (r < 14 || r > 26) map[r][BOSS_ZONE_START_COL - 1] = T.WALL;
  }
  return map;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface Entity {
  id: number; x: number; y: number; hp: number; maxHp: number; dead: boolean;
}
interface Enemy extends Entity {
  type: "goblin" | "skeleton" | "orc";
  vx: number; vy: number; aggroRange: number; attackTimer: number; color: string;
}
interface Boss extends Entity {
  phase: 1 | 2; vx: number; vy: number; attackTimer: number; enraged: boolean;
}
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number;
}
interface DroppedItem {
  item: Item; x: number; y: number; bobOffset: number;
}
interface GameState {
  player: {
    x: number; y: number; hp: number; maxHp: number; mp: number; maxMp: number;
    xp: number; xpNext: number; level: number; attack: number;
    facing: "up" | "down" | "left" | "right";
    attackTimer: number; invincible: number; skillCooldown: number;
  };
  inventory: Item[];
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedRing: Item | null;
  droppedItems: DroppedItem[];
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
interface InputState {
  dx: number; dy: number; attack: boolean; skill: boolean;
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
      id: id++, type: t,
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
      hp: t === "orc" ? 80 : t === "skeleton" ? 50 : 30,
      maxHp: t === "orc" ? 80 : t === "skeleton" ? 50 : 30,
      vx: 0, vy: 0, dead: false,
      aggroRange: t === "orc" ? 200 : t === "skeleton" ? 180 : 160,
      attackTimer: 0, color: colors[t],
    });
  }
  return enemies;
}

function spawnBoss(): Boss {
  return {
    id: 9999,
    x: (BOSS_ZONE_START_COL + 5) * TILE_SIZE,
    y: MAP_ROWS / 2 * TILE_SIZE,
    hp: 500, maxHp: 500,
    vx: 0, vy: 0, dead: false,
    phase: 1, attackTimer: 0, enraged: false,
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

function spawnParticles(particles: Particle[], x: number, y: number, color: string, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

// ─── Mini-map terrain colors ───────────────────────────────────────────────
const MM_COLORS: Record<number, string> = {
  0: "#2d5a1b", 1: "#1a4a6e", 2: "#777", 3: "#222",
  4: "#0d2a07", 5: "#9e8840", 6: "#2a2030", 7: "#3d1010",
};

// ─── Draw Anaël (humanoid player sprite) ──────────────────────────────────
function drawAnaël(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  facing: "up" | "down" | "left" | "right",
  attacking: boolean,
  invincible: number,
) {
  const flip = facing === "left";
  ctx.save();
  ctx.translate(px, py);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = invincible > 0 ? (Math.floor(invincible / 4) % 2 === 0 ? 0.35 : 1.0) : 1.0;

  const sx = facing === "up" ? -1 : 1; // shy mirroring for up view

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 17, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─ Boots ─
  ctx.fillStyle = "#3a2010";
  ctx.beginPath(); ctx.roundRect(-8, 11, 7, 5, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(1, 11, 7, 5, 2); ctx.fill();

  // ─ Legs / pants ─
  ctx.fillStyle = facing === "up" ? "#5a5060" : "#6a6070";
  ctx.fillRect(-7, 4, 5, 9);
  ctx.fillRect(2, 4, 5, 9);

  // ─ Hips / belt ─
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(-8, 3, 16, 4);
  // belt buckle
  ctx.fillStyle = "#c0960a";
  ctx.fillRect(-2, 4, 4, 2);

  // ─ Torso / tunic ─
  ctx.fillStyle = facing === "up" ? "#7a6858" : "#8a7060";
  ctx.beginPath(); ctx.roundRect(-7, -8, 14, 13, 2); ctx.fill();

  // Diagonal strap (left shoulder to right hip) — only for front-ish view
  if (facing !== "up") {
    ctx.strokeStyle = "#5a3820";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(4, 4);
    ctx.stroke();
  }

  // Tunic collar / neck line
  if (facing !== "up") {
    ctx.fillStyle = "#c8a070";
    ctx.beginPath(); ctx.roundRect(-2, -8, 4, 5, 1); ctx.fill();
  }

  // ─ Left shoulder pad ─
  ctx.fillStyle = "#7a6858";
  ctx.beginPath(); ctx.arc(-9, -6, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5a4840"; ctx.lineWidth = 1;
  ctx.stroke();

  // ─ Left arm ─
  ctx.fillStyle = "#c8a070";
  ctx.fillRect(-13, -4, 4, 9);

  // ─ Right shoulder pad ─
  ctx.fillStyle = "#7a6858";
  ctx.beginPath(); ctx.arc(9, -6, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5a4840"; ctx.lineWidth = 1;
  ctx.stroke();

  // ─ Sword + right arm ─
  const atkAngle = attacking ? -0.5 : 0.3;
  const swordX = 10;
  const swordY = -2;

  ctx.save();
  ctx.translate(swordX, swordY);
  ctx.rotate(atkAngle);

  // Right arm (holding sword)
  ctx.fillStyle = "#c8a070";
  ctx.fillRect(-2, 0, 4, 8);

  // Pommel
  ctx.fillStyle = "#806030";
  ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();

  // Handle
  ctx.fillStyle = "#9a6020";
  ctx.fillRect(-2, 6, 4, 10);

  // Crossguard
  ctx.fillStyle = "#b08030";
  ctx.beginPath(); ctx.roundRect(-7, 3, 14, 4, 1); ctx.fill();
  ctx.strokeStyle = "#906010"; ctx.lineWidth = 0.5; ctx.stroke();

  // Blade
  const bladeGrad = ctx.createLinearGradient(-3, -28, 3, -28);
  bladeGrad.addColorStop(0, "#e0e8f0");
  bladeGrad.addColorStop(0.5, "#ffffff");
  bladeGrad.addColorStop(1, "#a0b0c0");
  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.moveTo(-2.5, 4);
  ctx.lineTo(2.5, 4);
  ctx.lineTo(1, -28);
  ctx.lineTo(0, -32);
  ctx.lineTo(-1, -28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8090a0"; ctx.lineWidth = 0.5; ctx.stroke();

  // Blade shine
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0.5, 2);
  ctx.lineTo(-0.2, -26);
  ctx.stroke();

  ctx.restore();

  // ─ Head ─
  const headY = facing === "down" ? -16 : -15;

  // Neck
  ctx.fillStyle = "#c8a070";
  ctx.fillRect(-2, -12, 4, 5);

  // Head base
  ctx.fillStyle = "#d4aa78";
  ctx.beginPath(); ctx.arc(0, headY, 8, 0, Math.PI * 2); ctx.fill();

  // Hair (light sandy/blonde)
  ctx.fillStyle = "#c8a860";
  if (facing === "up") {
    // Show back of head - more hair
    ctx.beginPath(); ctx.arc(0, headY, 8.5, Math.PI, 0, false); ctx.fill();
    ctx.fillRect(-8, headY - 4, 16, 8);
    // Hair strands at back
    ctx.strokeStyle = "#b89850"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, headY + 4); ctx.lineTo(-7, headY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, headY + 4); ctx.lineTo(0, headY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, headY + 4); ctx.lineTo(7, headY + 10); ctx.stroke();
  } else {
    // Front hair: covering top and slightly over sides
    ctx.beginPath(); ctx.arc(0, headY, 8.5, Math.PI * 1.1, Math.PI * 0.0, false); ctx.fill();
    ctx.fillRect(-9, headY - 5, 18, 7);
    // Hair part / slightly messy strands
    ctx.strokeStyle = "#b89850"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, headY - 5); ctx.lineTo(-8, headY - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, headY - 7); ctx.lineTo(-2, headY - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, headY - 6); ctx.lineTo(5, headY - 9); ctx.stroke();
    // Side hair bits
    ctx.fillStyle = "#c8a860";
    ctx.beginPath(); ctx.arc(-8, headY + 1, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Face (only when not facing up)
  if (facing !== "up") {
    // Eyes
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.arc(-3, headY - 1, 1.5, 0, Math.PI * 2);
    ctx.arc(3, headY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-2.5, headY - 1.5, 0.5, 0, Math.PI * 2);
    ctx.arc(3.5, headY - 1.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Stern eyebrows
    ctx.strokeStyle = "#7a5830"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, headY - 3.5); ctx.lineTo(-1.5, headY - 2.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, headY - 3.5); ctx.lineTo(1.5, headY - 2.5); ctx.stroke();
    // Nose hint
    ctx.fillStyle = "#b89060";
    ctx.beginPath(); ctx.arc(0, headY + 2, 1, 0, Math.PI * 2); ctx.fill();
    // Mouth (slight determination line)
    ctx.strokeStyle = "#9a6840"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2, headY + 4.5); ctx.lineTo(2, headY + 4.5); ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function initState(save: SaveData | null): GameState {
  const map = generateMap();
  const basePlayer = {
    x: 3 * TILE_SIZE, y: MAP_ROWS / 2 * TILE_SIZE,
    hp: save ? save.maxHp : 100,
    maxHp: save ? save.maxHp : 100,
    mp: save ? save.maxMp : 60,
    maxMp: save ? save.maxMp : 60,
    xp: save ? save.xp : 0,
    xpNext: save ? save.xpNext : 100,
    level: save ? save.level : 1,
    attack: save ? save.attack : 18,
    facing: "right" as const,
    attackTimer: 0, invincible: 0, skillCooldown: 0,
  };
  return {
    player: basePlayer,
    inventory: save ? save.inventory : [],
    equippedWeapon: save ? save.equippedWeapon : null,
    equippedArmor: save ? save.equippedArmor : null,
    equippedRing: save ? save.equippedRing : null,
    droppedItems: [],
    enemies: spawnEnemies(),
    boss: null,
    particles: [],
    map,
    camera: { x: 0, y: 0 },
    kills: save ? save.kills : 0,
    gamePhase: "explore",
    bossTriggered: false,
    floatingTexts: [],
  };
}

function saveGame(s: GameState) {
  writeSave({
    level: s.player.level,
    xp: s.player.xp,
    xpNext: s.player.xpNext,
    maxHp: s.player.maxHp,
    maxMp: s.player.maxMp,
    attack: s.player.attack,
    kills: s.kills,
    inventory: s.inventory,
    equippedWeapon: s.equippedWeapon,
    equippedArmor: s.equippedArmor,
    equippedRing: s.equippedRing,
  });
}

// ─── Inventory Panel Component ─────────────────────────────────────────────
interface InventoryPanelProps {
  items: Item[];
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedRing: Item | null;
  onUse: (item: Item) => void;
  onEquip: (item: Item) => void;
  onClose: () => void;
  playerAtk: number;
  playerHp: number;
  playerMaxHp: number;
  playerMp: number;
  playerMaxMp: number;
  hasSave: boolean;
  onDeleteSave: () => void;
}

function InventoryPanel({
  items, equippedWeapon, equippedArmor, equippedRing,
  onUse, onEquip, onClose, playerAtk, playerHp, playerMaxHp,
  playerMp, playerMaxMp, hasSave, onDeleteSave,
}: InventoryPanelProps) {
  const [selected, setSelected] = useState<Item | null>(null);
  const equipped = [equippedWeapon, equippedArmor, equippedRing].filter(Boolean) as Item[];

  const isEquipped = (item: Item) =>
    equippedWeapon?.id === item.id ||
    equippedArmor?.id === item.id ||
    equippedRing?.id === item.id;

  return (
    <div
      data-testid="inventory-panel"
      style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "linear-gradient(160deg,#1a1228,#0e0a1a)",
        border: "2px solid rgba(180,100,255,0.5)",
        borderRadius: 14,
        padding: "16px",
        width: "min(420px, 94vw)",
        maxHeight: "88vh",
        overflowY: "auto",
        boxShadow: "0 0 40px rgba(120,60,200,0.4)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: 16 }}>🎒 Inventaire d'Aranel</div>
          <button
            data-testid="button-close-inventory"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6, color: "#fff", fontSize: 14, cursor: "pointer", padding: "2px 10px",
            }}
          >✕</button>
        </div>

        {/* Player stats */}
        <div style={{
          background: "rgba(255,255,255,0.05)", borderRadius: 8,
          padding: "8px 12px", marginBottom: 12,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6, fontSize: 11,
        }}>
          <div style={{ color: "#ff8888" }}>❤️ {Math.ceil(playerHp)}/{playerMaxHp}</div>
          <div style={{ color: "#8899ff" }}>✨ {Math.floor(playerMp)}/{playerMaxMp}</div>
          <div style={{ color: "#ffcc44" }}>⚔️ ATT {playerAtk}</div>
        </div>

        {/* Equipped items */}
        {equipped.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 6, textTransform: "uppercase" }}>Équipé</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {equipped.map(it => (
                <div
                  key={it.id}
                  style={{
                    background: "rgba(255,200,0,0.12)",
                    border: `1px solid ${RARITY_COLOR[it.rarity]}`,
                    borderRadius: 8, padding: "6px 10px",
                    display: "flex", alignItems: "center", gap: 6,
                    cursor: "pointer", fontSize: 12,
                  }}
                  onClick={() => setSelected(it)}
                >
                  <span style={{ fontSize: 18 }}>{it.emoji}</span>
                  <div>
                    <div style={{ color: RARITY_COLOR[it.rarity], fontWeight: "bold", fontSize: 11 }}>{it.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9 }}>{it.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item grid */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 6, textTransform: "uppercase" }}>
            Sac ({items.length} objet{items.length !== 1 ? "s" : ""})
          </div>
          {items.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: 20 }}>
              Aucun objet — tuez des ennemis pour récupérer des objets !
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {items.map((item, idx) => {
                const eq = isEquipped(item);
                const sel = selected?.id === item.id && selected === items[idx];
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    data-testid={`item-${item.id}-${idx}`}
                    onClick={() => setSelected(sel ? null : items[idx])}
                    style={{
                      background: sel ? "rgba(180,100,255,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${sel ? RARITY_COLOR[item.rarity] : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 10, padding: "10px 8px",
                      cursor: "pointer", textAlign: "center",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                  >
                    {eq && (
                      <div style={{
                        position: "absolute", top: 4, right: 4,
                        fontSize: 8, color: "#ffd700",
                        background: "rgba(0,0,0,0.6)", borderRadius: 3, padding: "1px 3px",
                      }}>EQ</div>
                    )}
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{item.emoji}</div>
                    <div style={{ color: RARITY_COLOR[item.rarity], fontWeight: "bold", fontSize: 10, lineHeight: 1.2 }}>{item.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, marginTop: 3 }}>{item.description}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected item actions */}
        {selected && (
          <div style={{
            background: "rgba(180,100,255,0.12)",
            border: "1px solid rgba(180,100,255,0.4)",
            borderRadius: 10, padding: "12px",
            marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{selected.emoji}</span>
              <div>
                <div style={{ color: RARITY_COLOR[selected.rarity], fontWeight: "bold", fontSize: 13 }}>{selected.name}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{selected.description}</div>
                <div style={{
                  display: "inline-block", marginTop: 3,
                  padding: "1px 6px", borderRadius: 4,
                  background: `${RARITY_COLOR[selected.rarity]}22`,
                  border: `1px solid ${RARITY_COLOR[selected.rarity]}`,
                  color: RARITY_COLOR[selected.rarity],
                  fontSize: 9, textTransform: "capitalize",
                }}>{selected.rarity}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {selected.type === "potion" ? (
                <button
                  data-testid="button-use-item"
                  onClick={() => { onUse(selected); setSelected(null); }}
                  style={{
                    flex: 1, padding: "8px 0",
                    background: "rgba(80,200,120,0.2)", border: "1px solid #4dc88a",
                    borderRadius: 8, color: "#4dc88a", fontWeight: "bold",
                    fontSize: 12, cursor: "pointer",
                  }}
                >Utiliser</button>
              ) : (
                <button
                  data-testid="button-equip-item"
                  onClick={() => { onEquip(selected); setSelected(null); }}
                  style={{
                    flex: 1, padding: "8px 0",
                    background: isEquipped(selected) ? "rgba(255,80,80,0.2)" : "rgba(80,150,255,0.2)",
                    border: `1px solid ${isEquipped(selected) ? "#ff5050" : "#4a9eff"}`,
                    borderRadius: 8,
                    color: isEquipped(selected) ? "#ff8080" : "#4a9eff",
                    fontWeight: "bold", fontSize: 12, cursor: "pointer",
                  }}
                >{isEquipped(selected) ? "Déséquiper" : "Équiper"}</button>
              )}
            </div>
          </div>
        )}

        {/* Save controls */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
            💾 Sauvegarde automatique active
          </div>
          {hasSave && (
            <button
              data-testid="button-delete-save"
              onClick={onDeleteSave}
              style={{
                background: "rgba(180,30,30,0.2)", border: "1px solid rgba(200,50,50,0.5)",
                borderRadius: 6, color: "#ff7070", fontSize: 10,
                cursor: "pointer", padding: "4px 10px",
              }}
            >Effacer sauvegarde</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveRef = useRef<SaveData | null>(loadSave());
  const stateRef = useRef<GameState>(initState(saveRef.current));
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, attack: false, skill: false });
  const rafRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const [showInventory, setShowInventory] = useState(false);
  const [hasSave, setHasSave] = useState(!!loadSave());
  const [hud, setHud] = useState(() => {
    const s = stateRef.current;
    return {
      hp: s.player.hp, maxHp: s.player.maxHp,
      mp: s.player.mp, maxMp: s.player.maxMp,
      xp: s.player.xp, xpNext: s.player.xpNext,
      level: s.player.level, kills: s.kills,
      bossHp: 0, bossMaxHp: 500,
      gamePhase: "explore" as GameState["gamePhase"],
      skillCooldown: 0, skillMaxCooldown: 120,
      inventory: s.inventory,
      equippedWeapon: s.equippedWeapon,
      equippedArmor: s.equippedArmor,
      equippedRing: s.equippedRing,
    };
  });

  // ─── Touch joystick ────────────────────────────────────────────────────
  const joystickOriginRef = useRef<{ x: number; y: number } | null>(null);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dpadRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (showInventory) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (target.dataset.action === "attack") { inputRef.current.attack = true; return; }
      if (target.dataset.action === "skill") { inputRef.current.skill = true; return; }
      if (touch.clientX < window.innerWidth / 2) {
        if (joystickTouchIdRef.current === null) {
          joystickTouchIdRef.current = touch.identifier;
          joystickOriginRef.current = { x: touch.clientX, y: touch.clientY };
          joystickPosRef.current = { x: 0, y: 0 };
        }
      }
    }
  }, [showInventory]);

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
          const nx = dx / len, ny = dy / len;
          joystickPosRef.current = { x: nx * Math.min(len, maxR), y: ny * Math.min(len, maxR) };
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
      if (e.key === "i" || e.key === "I") { setShowInventory(v => !v); return; }
      keys.add(e.key);
      let dx = 0, dy = 0;
      if (keys.has("ArrowLeft") || keys.has("a")) dx = -1;
      if (keys.has("ArrowRight") || keys.has("d")) dx = 1;
      if (keys.has("ArrowUp") || keys.has("w")) dy = -1;
      if (keys.has("ArrowDown") || keys.has("s")) dy = 1;
      inputRef.current.dx = dx; inputRef.current.dy = dy;
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
      inputRef.current.dx = dx; inputRef.current.dy = dy;
      if (e.key === " " || e.key === "z") inputRef.current.attack = false;
      if (e.key === "x" || e.key === "q") inputRef.current.skill = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // ─── Inventory actions ─────────────────────────────────────────────────
  const handleUseItem = useCallback((item: Item) => {
    const s = stateRef.current;
    const p = s.player;
    if (item.healHp) p.hp = Math.min(p.maxHp, p.hp + item.healHp);
    if (item.healMp) p.mp = Math.min(p.maxMp, p.mp + item.healMp);
    s.inventory = s.inventory.filter((_, i) => s.inventory.indexOf(item) !== i || (s.inventory.splice(s.inventory.indexOf(item), 1) && false));
    // Remove first occurrence
    const idx = s.inventory.findIndex(it => it.id === item.id);
    if (idx !== -1) s.inventory.splice(idx, 1);
    s.floatingTexts.push({ x: p.x, y: p.y - 50, text: item.healHp ? `+${item.healHp} HP` : `+${item.healMp} MP`, color: item.healHp ? "#88ff88" : "#8888ff", life: 70 });
    spawnParticles(s.particles, p.x, p.y, item.healHp ? "#44ff88" : "#4488ff", 8);
    saveGame(s);
    setHasSave(true);
  }, []);

  const handleEquipItem = useCallback((item: Item) => {
    const s = stateRef.current;
    const p = s.player;

    const unequip = (slot: Item | null, type: ItemType) => {
      if (!slot) return;
      if (slot.bonusAtk) p.attack -= slot.bonusAtk;
      if (slot.bonusHp) { p.maxHp -= slot.bonusHp; p.hp = Math.min(p.hp, p.maxHp); }
      if (slot.bonusMp) { p.maxMp -= slot.bonusMp; p.mp = Math.min(p.mp, p.maxMp); }
    };

    const equip = (it: Item) => {
      if (it.bonusAtk) p.attack += it.bonusAtk;
      if (it.bonusHp) { p.maxHp += it.bonusHp; p.hp = Math.min(p.hp + it.bonusHp, p.maxHp); }
      if (it.bonusMp) { p.maxMp += it.bonusMp; p.mp = Math.min(p.mp + it.bonusMp, p.maxMp); }
    };

    // Toggle: unequip if already equipped
    if (item.type === "weapon") {
      if (s.equippedWeapon?.id === item.id) {
        unequip(s.equippedWeapon, "weapon"); s.equippedWeapon = null;
      } else {
        unequip(s.equippedWeapon, "weapon"); s.equippedWeapon = item; equip(item);
      }
    } else if (item.type === "armor") {
      if (s.equippedArmor?.id === item.id) {
        unequip(s.equippedArmor, "armor"); s.equippedArmor = null;
      } else {
        unequip(s.equippedArmor, "armor"); s.equippedArmor = item; equip(item);
      }
    } else if (item.type === "ring" || item.type === "amulet") {
      if (s.equippedRing?.id === item.id) {
        unequip(s.equippedRing, "ring"); s.equippedRing = null;
      } else {
        unequip(s.equippedRing, "ring"); s.equippedRing = item; equip(item);
      }
    }
    spawnParticles(s.particles, p.x, p.y, "#ffd700", 8);
    saveGame(s);
    setHasSave(true);
  }, []);

  const handleDeleteSave = useCallback(() => {
    deleteSave();
    setHasSave(false);
  }, []);

  // ─── Game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // Generate cached mini-map terrain bitmap once
    const mmOff = document.createElement("canvas");
    mmOff.width = MAP_COLS * 2;
    mmOff.height = MAP_ROWS * 2;
    const mmCtx = mmOff.getContext("2d")!;
    const s0 = stateRef.current;
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        mmCtx.fillStyle = MM_COLORS[s0.map[r][c]] ?? "#2d5a1b";
        mmCtx.fillRect(c * 2, r * 2, 2, 2);
      }
    }
    minimapRef.current = mmOff;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      frameRef.current++;
      const s = stateRef.current;
      const inp = inputRef.current;
      const W = canvas.width;
      const H = canvas.height;

      if (s.gamePhase === "dead" || s.gamePhase === "victory") {
        drawEndScreen(ctx, W, H, s);
        return;
      }

      // pause movement when inventory open (game still renders)
      const paused = false; // inventory doesn't pause the game frame

      // ── Update player ──────────────────────────────────────────────
      const p = s.player;
      if (p.attackTimer > 0) p.attackTimer--;
      if (p.invincible > 0) p.invincible--;
      if (p.skillCooldown > 0) p.skillCooldown--;

      const len = Math.sqrt(inp.dx * inp.dx + inp.dy * inp.dy);
      if (len > 0 && !paused) {
        const nx = inp.dx / len, ny = inp.dy / len;
        if (canMoveTo(s.map, p.x + nx * PLAYER_SPEED, p.y, PLAYER_SIZE)) p.x += nx * PLAYER_SPEED;
        if (canMoveTo(s.map, p.x, p.y + ny * PLAYER_SPEED, PLAYER_SIZE)) p.y += ny * PLAYER_SPEED;
        if (Math.abs(nx) > Math.abs(ny)) p.facing = nx > 0 ? "right" : "left";
        else p.facing = ny > 0 ? "down" : "up";
      }
      p.x = Math.max(PLAYER_SIZE / 2, Math.min(MAP_COLS * TILE_SIZE - PLAYER_SIZE / 2, p.x));
      p.y = Math.max(PLAYER_SIZE / 2, Math.min(MAP_ROWS * TILE_SIZE - PLAYER_SIZE / 2, p.y));
      if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + 0.05);

      // Boss trigger
      if (!s.bossTriggered && p.x > BOSS_ZONE_START_COL * TILE_SIZE) {
        s.bossTriggered = true;
        s.boss = spawnBoss();
        s.gamePhase = "boss";
      }

      // Pick up dropped items
      s.droppedItems = s.droppedItems.filter(di => {
        if (distance(p.x, p.y, di.x, di.y) < 28) {
          if (s.inventory.length < 24) {
            s.inventory.push(di.item);
            s.floatingTexts.push({ x: di.x, y: di.y - 30, text: `+ ${di.item.name}`, color: RARITY_COLOR[di.item.rarity], life: 80 });
            spawnParticles(s.particles, di.x, di.y, RARITY_COLOR[di.item.rarity], 6);
            saveGame(s);
          }
          return false;
        }
        return true;
      });

      // ── Attack ─────────────────────────────────────────────────────
      const ATTACK_RANGE = 55, ATTACK_COOLDOWN = 22;
      if (inp.attack && p.attackTimer === 0 && !paused) {
        p.attackTimer = ATTACK_COOLDOWN;
        s.enemies.forEach(en => {
          if (en.dead) return;
          if (distance(p.x, p.y, en.x, en.y) < ATTACK_RANGE + ENEMY_SIZE / 2) {
            en.hp -= p.attack;
            spawnParticles(s.particles, en.x, en.y, "#ff4444", 5);
            s.floatingTexts.push({ x: en.x, y: en.y - 20, text: `-${p.attack}`, color: "#ff6666", life: 45 });
            if (en.hp <= 0) {
              en.dead = true; s.kills++;
              p.xp += en.type === "orc" ? 35 : en.type === "skeleton" ? 20 : 12;
              spawnParticles(s.particles, en.x, en.y, "#ffd700", 10);
              // Drop item
              const drop = rollDrop(en.type);
              if (drop) s.droppedItems.push({ item: drop, x: en.x + (Math.random() - 0.5) * 20, y: en.y + (Math.random() - 0.5) * 20, bobOffset: Math.random() * Math.PI * 2 });
              if (p.xp >= p.xpNext) {
                p.xp -= p.xpNext; p.level++;
                p.xpNext = Math.floor(p.xpNext * 1.4);
                p.maxHp += 15; p.hp = Math.min(p.hp + 20, p.maxHp);
                p.maxMp += 8; p.attack += 5;
                s.floatingTexts.push({ x: p.x, y: p.y - 50, text: "NIVEAU +", color: "#ffd700", life: 90 });
                saveGame(s);
              }
            }
          }
        });
        if (s.boss && !s.boss.dead) {
          const d = distance(p.x, p.y, s.boss.x, s.boss.y);
          if (d < ATTACK_RANGE + BOSS_SIZE / 2) {
            s.boss.hp -= p.attack;
            spawnParticles(s.particles, s.boss.x, s.boss.y, "#ff2200", 8);
            s.floatingTexts.push({ x: s.boss.x + (Math.random() - 0.5) * 40, y: s.boss.y - 30, text: `-${p.attack}`, color: "#ff4444", life: 50 });
            if (s.boss.hp <= 0) {
              s.boss.dead = true; s.gamePhase = "victory";
              spawnParticles(s.particles, s.boss.x, s.boss.y, "#ffd700", 40);
              const bossDrops = rollBossDrop();
              bossDrops.forEach((bd, bi) => s.droppedItems.push({ item: bd, x: s.boss!.x + (bi - 0.5) * 60, y: s.boss!.y, bobOffset: bi }));
              saveGame(s);
            }
            if (s.boss.hp < s.boss.maxHp * 0.4 && !s.boss.enraged) {
              s.boss.enraged = true; s.boss.phase = 2;
              s.floatingTexts.push({ x: s.boss.x, y: s.boss.y - 80, text: "ENRAGÉ!", color: "#ff0000", life: 90 });
            }
          }
        }
      }

      // ── Skill ──────────────────────────────────────────────────────
      const SKILL_COOLDOWN = 120;
      if (inp.skill && p.skillCooldown === 0 && p.mp >= 20 && !paused) {
        p.skillCooldown = SKILL_COOLDOWN; p.mp -= 20;
        const SKILL_RANGE = 110;
        s.enemies.forEach(en => {
          if (en.dead) return;
          if (distance(p.x, p.y, en.x, en.y) < SKILL_RANGE) {
            const dmg = Math.floor(p.attack * 1.8);
            en.hp -= dmg;
            spawnParticles(s.particles, en.x, en.y, "#a060ff", 8);
            s.floatingTexts.push({ x: en.x, y: en.y - 20, text: `-${dmg}`, color: "#cc88ff", life: 45 });
            if (en.hp <= 0) {
              en.dead = true; s.kills++;
              const drop = rollDrop(en.type);
              if (drop) s.droppedItems.push({ item: drop, x: en.x, y: en.y, bobOffset: Math.random() * Math.PI * 2 });
            }
          }
        });
        if (s.boss && !s.boss.dead && distance(p.x, p.y, s.boss.x, s.boss.y) < SKILL_RANGE) {
          const dmg = Math.floor(p.attack * 2);
          s.boss.hp -= dmg;
          spawnParticles(s.particles, s.boss.x, s.boss.y, "#a060ff", 12);
          s.floatingTexts.push({ x: s.boss.x, y: s.boss.y - 40, text: `-${dmg} MAGIE`, color: "#cc88ff", life: 60 });
          if (s.boss.hp <= 0) { s.boss.dead = true; s.gamePhase = "victory"; saveGame(s); }
        }
        spawnParticles(s.particles, p.x, p.y, "#8844ff", 14);
      }

      // ── Enemy AI ───────────────────────────────────────────────────
      s.enemies.forEach(en => {
        if (en.dead) return;
        const d = distance(p.x, p.y, en.x, en.y);
        if (d < en.aggroRange) {
          const dx2 = p.x - en.x, dy2 = p.y - en.y;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (len2 > 0) {
            const spd = en.type === "orc" ? 1.0 : en.type === "skeleton" ? 1.3 : 1.6;
            en.vx = (dx2 / len2) * spd; en.vy = (dy2 / len2) * spd;
          }
        } else { en.vx *= 0.9; en.vy *= 0.9; }
        if (canMoveTo(s.map, en.x + en.vx, en.y, ENEMY_SIZE)) en.x += en.vx;
        if (canMoveTo(s.map, en.x, en.y + en.vy, ENEMY_SIZE)) en.y += en.vy;
        if (d < 32 && en.attackTimer === 0 && p.invincible === 0) {
          const dmg = en.type === "orc" ? 12 : en.type === "skeleton" ? 8 : 5;
          p.hp -= dmg; p.invincible = 35; en.attackTimer = 55;
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
        const spd = b.enraged ? 2.2 : 1.4;
        if (d > 50) {
          const dx2 = p.x - b.x, dy2 = p.y - b.y;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          b.vx = (dx2 / len2) * spd; b.vy = (dy2 / len2) * spd;
        } else { b.vx *= 0.8; b.vy *= 0.8; }
        if (canMoveTo(s.map, b.x + b.vx, b.y, BOSS_SIZE)) b.x += b.vx;
        if (canMoveTo(s.map, b.x, b.y + b.vy, BOSS_SIZE)) b.y += b.vy;
        const cd = b.enraged ? 60 : 90;
        if (d < BOSS_SIZE && b.attackTimer === 0 && p.invincible === 0) {
          const dmg = b.enraged ? 22 : 15;
          p.hp -= dmg; p.invincible = 30; b.attackTimer = cd;
          spawnParticles(s.particles, p.x, p.y, "#ff0000", 8);
          s.floatingTexts.push({ x: p.x, y: p.y - 50, text: `-${dmg}`, color: "#ff2222", life: 55 });
          if (p.hp <= 0) { p.hp = 0; s.gamePhase = "dead"; }
        }
        if (b.attackTimer > 0) b.attackTimer--;
      }

      // ── Particles ──────────────────────────────────────────────────
      s.particles = s.particles.filter(pt => pt.life > 0);
      s.particles.forEach(pt => {
        pt.x += pt.vx; pt.y += pt.vy;
        pt.vx *= 0.92; pt.vy *= 0.92;
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

      const startCol = Math.max(0, Math.floor(s.camera.x / TILE_SIZE));
      const endCol   = Math.min(MAP_COLS - 1, Math.ceil((s.camera.x + W) / TILE_SIZE));
      const startRow = Math.max(0, Math.floor(s.camera.y / TILE_SIZE));
      const endRow   = Math.min(MAP_ROWS - 1, Math.ceil((s.camera.y + H) / TILE_SIZE));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = s.map[r][c];
          const tc = TILE_COLORS[tile];
          ctx.fillStyle = tc.fill;
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = tc.stroke; ctx.lineWidth = 0.5;
          ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          if (tile === T.GRASS && Math.sin(r * 31 + c * 17) > 0.6) {
            ctx.fillStyle = "#3a7023";
            ctx.fillRect(c * TILE_SIZE + 8, r * TILE_SIZE + 14, 3, 10);
            ctx.fillRect(c * TILE_SIZE + 18, r * TILE_SIZE + 10, 3, 12);
            ctx.fillRect(c * TILE_SIZE + 28, r * TILE_SIZE + 16, 3, 8);
          }
          if (tile === T.FOREST) {
            ctx.fillStyle = "#0d2a07";
            ctx.beginPath(); ctx.arc(c * TILE_SIZE + 20, r * TILE_SIZE + 20, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#1d4d0f";
            ctx.beginPath(); ctx.arc(c * TILE_SIZE + 20, r * TILE_SIZE + 18, 10, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // Dropped items
      const now = Date.now() / 1000;
      s.droppedItems.forEach(di => {
        const bob = Math.sin(now * 3 + di.bobOffset) * 4;
        const glow = ctx.createRadialGradient(di.x, di.y + bob, 0, di.x, di.y + bob, 18);
        glow.addColorStop(0, `${RARITY_COLOR[di.item.rarity]}66`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(di.x, di.y + bob, 18, 0, Math.PI * 2); ctx.fill();
        ctx.font = "18px serif"; ctx.textAlign = "center";
        ctx.fillText(di.item.emoji, di.x, di.y + bob + 7);
      });

      // Enemies
      s.enemies.forEach(en => {
        if (en.dead) return;
        const ex = en.x, ey = en.y;
        if (ex + ENEMY_SIZE < s.camera.x || ex - ENEMY_SIZE > s.camera.x + W) return;
        if (ey + ENEMY_SIZE < s.camera.y || ey - ENEMY_SIZE > s.camera.y + H) return;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(ex, ey + ENEMY_SIZE / 2 - 2, ENEMY_SIZE / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = en.color;
        ctx.beginPath(); ctx.arc(ex, ey, ENEMY_SIZE / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath(); ctx.arc(ex - 4, ey - 2, 3, 0, Math.PI * 2); ctx.arc(ex + 4, ey - 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff3300";
        ctx.beginPath(); ctx.arc(ex - 4, ey - 2, 1.5, 0, Math.PI * 2); ctx.arc(ex + 4, ey - 2, 1.5, 0, Math.PI * 2); ctx.fill();
        const bw = 30, bh = 5, bx = ex - bw / 2, by = ey - ENEMY_SIZE / 2 - 10;
        ctx.fillStyle = "#300"; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = "#e33"; ctx.fillRect(bx, by, bw * (en.hp / en.maxHp), bh);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(ex - 18, by - 12, 36, 11);
        ctx.fillStyle = "#fff"; ctx.font = "bold 8px Arial"; ctx.textAlign = "center";
        ctx.fillText(en.type.toUpperCase(), ex, by - 3);
      });

      // Boss
      if (s.boss && !s.boss.dead) {
        const b = s.boss;
        const anim = Math.sin(Date.now() / 200) * 4;
        const grad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, BOSS_SIZE + 20);
        grad.addColorStop(0, b.enraged ? "rgba(255,50,0,0.5)" : "rgba(150,0,200,0.4)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(b.x, b.y, BOSS_SIZE + 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.ellipse(b.x, b.y + BOSS_SIZE / 2, BOSS_SIZE / 2 + 5, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = b.enraged ? "#6a0000" : "#3a0060";
        ctx.beginPath(); ctx.arc(b.x, b.y + anim, BOSS_SIZE / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = b.enraged ? "#8b0000" : "#5a0090";
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Date.now() / 2000;
          ctx.beginPath();
          ctx.arc(b.x + Math.cos(ang) * (BOSS_SIZE / 2 - 8), b.y + anim + Math.sin(ang) * (BOSS_SIZE / 2 - 8), 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = b.enraged ? "#ff4400" : "#9900cc";
        ctx.beginPath();
        ctx.moveTo(b.x - 16, b.y + anim - BOSS_SIZE / 2 + 4);
        ctx.lineTo(b.x - 10, b.y + anim - BOSS_SIZE / 2 - 14);
        ctx.lineTo(b.x - 4,  b.y + anim - BOSS_SIZE / 2 + 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.x + 4,  b.y + anim - BOSS_SIZE / 2 + 2);
        ctx.lineTo(b.x + 10, b.y + anim - BOSS_SIZE / 2 - 14);
        ctx.lineTo(b.x + 16, b.y + anim - BOSS_SIZE / 2 + 4);
        ctx.fill();
        ctx.fillStyle = b.enraged ? "#ff8800" : "#cc00ff";
        ctx.beginPath(); ctx.arc(b.x - 8, b.y + anim - 6, 6, 0, Math.PI * 2); ctx.arc(b.x + 8, b.y + anim - 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(b.x - 8, b.y + anim - 6, 2.5, 0, Math.PI * 2); ctx.arc(b.x + 8, b.y + anim - 6, 2.5, 0, Math.PI * 2); ctx.fill();
        const lY = b.y + anim - BOSS_SIZE / 2 - 30;
        ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(b.x - 44, lY - 14, 88, 18);
        ctx.fillStyle = b.enraged ? "#ff4400" : "#cc00ff";
        ctx.fillText(b.enraged ? "SEIGNEUR OBLIVION ★" : "SEIGNEUR OBLIVION", b.x, lY);
      }

      // Player — humanoid Anaël sprite
      drawAnaël(ctx, p.x, p.y, p.facing, p.attackTimer > ATTACK_COOLDOWN * 0.5, p.invincible);

      // Particles
      s.particles.forEach(pt => {
        if (pt.life <= 0) return;
        const a = Math.max(0, pt.life / pt.maxLife);
        if (a <= 0) return;
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, pt.size * a), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Floating texts
      s.floatingTexts.forEach(ft => {
        ctx.globalAlpha = Math.min(1, ft.life / 45);
        ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
        ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y);
      });
      ctx.globalAlpha = 1.0;
      ctx.restore();

      // ── Mini-map ────────────────────────────────────────────────
      {
        const MW = 100, MH = 80;
        const mx = Math.floor(W / 2 - MW / 2);
        const my = H - MH - 52;
        // Background
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.beginPath();
        ctx.roundRect(mx - 3, my - 14, MW + 6, MH + 17, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,215,0,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Label
        ctx.fillStyle = "rgba(255,215,0,0.55)";
        ctx.font = "bold 8px Arial";
        ctx.textAlign = "center";
        ctx.fillText("CARTE", mx + MW / 2, my - 3);
        // Terrain: use cached minimap bitmap if available
        if (minimapRef.current) {
          ctx.drawImage(minimapRef.current, mx, my, MW, MH);
        }
        // Camera viewport rectangle
        const camScaleX = MW / (MAP_COLS * TILE_SIZE);
        const camScaleY = MH / (MAP_ROWS * TILE_SIZE);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(
          mx + s.camera.x * camScaleX,
          my + s.camera.y * camScaleY,
          W * camScaleX,
          H * camScaleY,
        );
        // Enemies
        ctx.fillStyle = "#ff4444";
        s.enemies.forEach(en => {
          if (en.dead) return;
          const ex = mx + en.x * camScaleX;
          const ey = my + en.y * camScaleY;
          ctx.fillRect(ex - 1, ey - 1, 2.5, 2.5);
        });
        // Boss
        if (s.boss && !s.boss.dead) {
          ctx.fillStyle = "#cc00ff";
          const bx = mx + s.boss.x * camScaleX;
          const by = my + s.boss.y * camScaleY;
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // Player dot
        const ppx = mx + p.x * camScaleX;
        const ppy = my + p.y * camScaleY;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ppx, ppy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // HUD update every 3 frames
      if (frameRef.current % 3 === 0) {
        setHud({
          hp: Math.max(0, s.player.hp), maxHp: s.player.maxHp,
          mp: s.player.mp, maxMp: s.player.maxMp,
          xp: s.player.xp, xpNext: s.player.xpNext,
          level: s.player.level, kills: s.kills,
          bossHp: s.boss ? Math.max(0, s.boss.hp) : 0,
          bossMaxHp: s.boss ? s.boss.maxHp : 500,
          gamePhase: s.gamePhase,
          skillCooldown: s.player.skillCooldown,
          skillMaxCooldown: 120,
          inventory: [...s.inventory],
          equippedWeapon: s.equippedWeapon,
          equippedArmor: s.equippedArmor,
          equippedRing: s.equippedRing,
        });
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, []);

  const ATTACK_COOLDOWN = 22;

  const restart = useCallback(() => {
    deleteSave();
    setHasSave(false);
    stateRef.current = initState(null);
    setShowInventory(false);
  }, []);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#0a0a12", overflow: "hidden", touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* ── HUD ──────────────────────────────────────────────────── */}
      {hud.gamePhase !== "dead" && hud.gamePhase !== "victory" && (
        <>
          {/* Top-left stats */}
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,215,0,0.4)",
            borderRadius: 10, padding: "8px 12px", minWidth: 140,
            backdropFilter: "blur(4px)",
          }}>
            <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
              ARANEL — Niv. {hud.level}
            </div>
            {[
              { color: "#ff6666", bg: "#300", val: hud.hp, max: hud.maxHp, icon: "❤️", low: hud.hp < hud.maxHp * 0.25 },
              { color: "#44f",    bg: "#003", val: hud.mp, max: hud.maxMp, icon: "✨", low: false },
              { color: "#ffd700", bg: "#220", val: hud.xp, max: hud.xpNext, icon: "⭐", low: false },
            ].map(({ color, bg, val, max, icon, low }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: i < 2 ? 3 : 0 }}>
                <span style={{ fontSize: 10, width: 20 }}>{icon}</span>
                <div style={{ flex: 1, background: bg, borderRadius: 3, height: i === 2 ? 6 : 8 }}>
                  <div style={{ width: `${(val / max) * 100}%`, background: low ? "#ff2200" : color, height: "100%", borderRadius: 3, transition: "width 0.1s" }} />
                </div>
                {i < 2 && <span style={{ color: i === 0 ? "#ff9999" : "#aabbff", fontSize: 9, minWidth: 40 }}>{Math.ceil(val)}/{max}</span>}
              </div>
            ))}
          </div>

          {/* Top-right: kills + inventory button */}
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{
              background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,100,0,0.4)",
              borderRadius: 8, padding: "6px 10px",
              color: "#ff8844", fontWeight: "bold", fontSize: 12,
            }}>⚔️ {hud.kills}</div>
            <button
              data-testid="button-inventory"
              onClick={() => setShowInventory(v => !v)}
              style={{
                background: showInventory ? "rgba(180,100,255,0.3)" : "rgba(0,0,0,0.7)",
                border: `1px solid ${showInventory ? "rgba(180,100,255,0.8)" : "rgba(180,100,255,0.4)"}`,
                borderRadius: 8, padding: "6px 10px",
                color: "#cc88ff", fontWeight: "bold", fontSize: 12,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              🎒 {hud.inventory.length > 0 ? <span style={{ background: "#cc55ff", borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff" }}>{hud.inventory.length}</span> : null}
            </button>
          </div>

          {/* Boss HP */}
          {hud.gamePhase === "boss" && hud.bossHp > 0 && (
            <div style={{
              position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
              width: "min(320px, 65vw)",
              background: "rgba(0,0,0,0.8)", border: "2px solid #880000",
              borderRadius: 8, padding: "8px 12px", backdropFilter: "blur(4px)",
            }}>
              <div style={{ color: "#ff4444", fontWeight: "bold", fontSize: 11, textAlign: "center", marginBottom: 5 }}>
                ☠ SEIGNEUR OBLIVION {hud.bossHp < hud.bossMaxHp * 0.4 ? "★ ENRAGÉ" : ""}
              </div>
              <div style={{ background: "#300", borderRadius: 4, height: 14, border: "1px solid #600" }}>
                <div style={{
                  width: `${(hud.bossHp / hud.bossMaxHp) * 100}%`,
                  background: hud.bossHp < hud.bossMaxHp * 0.4 ? "linear-gradient(90deg,#ff0000,#ff6600)" : "linear-gradient(90deg,#880000,#cc0000)",
                  height: "100%", borderRadius: 4, transition: "width 0.1s",
                }} />
              </div>
              <div style={{ color: "#ff8888", fontSize: 10, textAlign: "center", marginTop: 2 }}>
                {Math.max(0, hud.bossHp)} / {hud.bossMaxHp}
              </div>
            </div>
          )}

          {/* Joystick */}
          <div
            ref={dpadRef}
            style={{
              position: "absolute", bottom: 30, left: 30,
              width: 110, height: 110, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{
              position: "absolute", width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,215,0,0.7)", border: "2px solid rgba(255,215,0,0.9)",
              transform: `translate(${joystickPosRef.current.x}px, ${joystickPosRef.current.y}px)`,
              transition: joystickTouchIdRef.current !== null ? "none" : "transform 0.1s",
              boxShadow: "0 0 10px rgba(255,215,0,0.5)",
            }} />
            {["↑", "↓", "←", "→"].map((arrow, i) => {
              const pos = [
                { top: 4, left: "50%", transform: "translateX(-50%)" },
                { bottom: 4, left: "50%", transform: "translateX(-50%)" },
                { left: 4, top: "50%", transform: "translateY(-50%)" },
                { right: 4, top: "50%", transform: "translateY(-50%)" },
              ];
              return <div key={arrow} style={{ position: "absolute", color: "rgba(255,255,255,0.5)", fontSize: 14, ...pos[i] }}>{arrow}</div>;
            })}
          </div>

          {/* Action buttons */}
          <div style={{ position: "absolute", bottom: 30, right: 20, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
            <div
              data-action="skill" data-testid="button-skill"
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: hud.skillCooldown > 0 ? "rgba(80,40,120,0.5)" : "rgba(140,60,220,0.85)",
                border: "2px solid rgba(180,100,255,0.8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 10, fontWeight: "bold", textAlign: "center",
                cursor: "pointer",
                boxShadow: hud.skillCooldown > 0 ? "none" : "0 0 12px rgba(160,80,255,0.6)",
                position: "relative", overflow: "hidden",
              }}
            >
              {hud.skillCooldown > 0 && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${((hud.skillMaxCooldown - hud.skillCooldown) / hud.skillMaxCooldown) * 100}%`,
                  background: "rgba(140,60,220,0.6)", transition: "height 0.05s",
                }} />
              )}
              <span style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                {hud.skillCooldown > 0 ? `${Math.ceil(hud.skillCooldown / 60 * 2)}s` : "✨\nMAGIE"}
              </span>
            </div>
            <div
              data-action="attack" data-testid="button-attack"
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(180,50,50,0.85)", border: "3px solid rgba(255,100,100,0.9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: "bold",
                cursor: "pointer", boxShadow: "0 0 14px rgba(255,60,60,0.6)",
                userSelect: "none",
              }}
            >⚔️<br />ATT</div>
          </div>

          {/* Hint */}
          <div style={{
            position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.3)", fontSize: 9, textAlign: "center", pointerEvents: "none",
          }}>
            ZQSD·Espace·X·I(inventaire)  |  Tactile: Joystick + Boutons
          </div>
        </>
      )}

      {/* ── Inventory overlay ─────────────────────────────────────── */}
      {showInventory && hud.gamePhase !== "dead" && hud.gamePhase !== "victory" && (
        <InventoryPanel
          items={hud.inventory}
          equippedWeapon={hud.equippedWeapon}
          equippedArmor={hud.equippedArmor}
          equippedRing={hud.equippedRing}
          onUse={handleUseItem}
          onEquip={handleEquipItem}
          onClose={() => setShowInventory(false)}
          playerAtk={stateRef.current.player.attack}
          playerHp={hud.hp}
          playerMaxHp={hud.maxHp}
          playerMp={hud.mp}
          playerMaxMp={hud.maxMp}
          hasSave={hasSave}
          onDeleteSave={handleDeleteSave}
        />
      )}

      {/* ── End screen ─────────────────────────────────────────────── */}
      {(hud.gamePhase === "dead" || hud.gamePhase === "victory") && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: hud.gamePhase === "victory" ? "rgba(10,8,0,0.85)" : "rgba(0,0,0,0.88)",
          flexDirection: "column", gap: 16,
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
          {hud.gamePhase === "victory" && (
            <div style={{ color: "rgba(255,215,0,0.6)", fontSize: 12 }}>
              Progression sauvegardée — votre inventaire est conservé !
            </div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            {hud.gamePhase === "dead" && hasSave && (
              <button
                data-testid="button-continue"
                onClick={() => {
                  const sv = loadSave();
                  stateRef.current = initState(sv);
                  setShowInventory(false);
                }}
                style={{
                  padding: "12px 28px",
                  background: "rgba(80,200,120,0.15)", border: "2px solid #4dc88a",
                  borderRadius: 8, color: "#4dc88a", fontSize: 14, fontWeight: "bold", cursor: "pointer",
                }}
              >Continuer depuis sauvegarde</button>
            )}
            <button
              data-testid="button-restart"
              onClick={restart}
              style={{
                padding: "12px 28px",
                background: "rgba(255,215,0,0.15)", border: "2px solid #ffd700",
                borderRadius: 8, color: "#ffd700", fontSize: 14, fontWeight: "bold", cursor: "pointer",
              }}
            >Nouvelle partie</button>
          </div>
        </div>
      )}
    </div>
  );
}

function drawEndScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: GameState) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-s.camera.x, -s.camera.y);
  s.particles.forEach(pt => {
    if (pt.life <= 0) return;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, pt.size), 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}
