export const GAME_NAMES: Record<string, string> = {
  MONSTER_HUNTER_WORLD: 'Monster Hunter: World',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'World: Iceborne',
  MONSTER_HUNTER_RISE: 'Monster Hunter Rise',
  MONSTER_HUNTER_RISE_SUNBREAK: 'Rise: Sunbreak',
  MONSTER_HUNTER_WILDS: 'Monster Hunter Wilds',
};

export const GAME_COLORS: Record<string, string> = {
  MONSTER_HUNTER_WORLD: 'text-amber-500',
  MONSTER_HUNTER_WORLD_ICEBORNE: 'text-blue-400',
  MONSTER_HUNTER_RISE: 'text-red-500',
  MONSTER_HUNTER_RISE_SUNBREAK: 'text-purple-400',
  MONSTER_HUNTER_WILDS: 'text-teal-400',
};

export const GAME_ORDER = [
  'MONSTER_HUNTER_WORLD',
  'MONSTER_HUNTER_WORLD_ICEBORNE',
  'MONSTER_HUNTER_RISE',
  'MONSTER_HUNTER_RISE_SUNBREAK',
  'MONSTER_HUNTER_WILDS',
] as const;

export const TYPE_BADGE_CLASSES: Record<string, string> = {
  Large: 'bg-amber-500/10 text-amber-500',
  ElderDragon: 'bg-violet-400/10 text-violet-400',
  Small: 'bg-stone-700 text-stone-400',
  Apex: 'bg-red-400/10 text-red-400',
  Afflicted: 'bg-red-400/10 text-red-400',
  Tempered: 'bg-red-400/10 text-red-400',
};

export const ELEMENT_COLORS: Record<string, string> = {
  Fire: 'text-red-500',
  Water: 'text-blue-500',
  Thunder: 'text-yellow-400',
  Ice: 'text-cyan-400',
  Dragon: 'text-violet-500',
  Poison: 'text-purple-500',
  Sleep: 'text-indigo-400',
  Paralysis: 'text-yellow-500',
  Blast: 'text-orange-500',
  Stun: 'text-amber-400',
};

export const DIFFICULTY_CLASSES: Record<string, string> = {
  Beginner: 'bg-green-500/10 text-green-500',
  Intermediate: 'bg-amber-500/10 text-amber-500',
  Advanced: 'bg-red-500/10 text-red-500',
};

export const DROP_METHOD_NAMES: Record<string, string> = {
  BodyCarve: 'Body Carve',
  TailCarve: 'Tail Carve',
  BreakReward: 'Break Reward',
  CaptureReward: 'Capture Reward',
  QuestReward: 'Quest Reward',
  ShinyDrop: 'Shiny Drop',
  WoundDrop: 'Wound Drop',
  PalicoBoomerang: 'Palico Boomerang',
};
