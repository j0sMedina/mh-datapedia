export const GAME_NAMES: Record<string, string> = {
  MONSTER_HUNTER_WILDS: 'Monster Hunter Wilds',
};

export const GAME_ORDER = ['MONSTER_HUNTER_WILDS'] as const;

export const TYPE_BADGE_CLASSES: Record<string, string> = {
  Large:           'bg-amber-500/10 text-amber-500',
  Small:           'bg-stone-700 text-stone-400',
  ElderDragon:     'bg-amber-400/10 text-amber-400',
  Apex:            'bg-red-400/10 text-red-400',
  Afflicted:       'bg-red-400/10 text-red-400',
  Tempered:        'bg-red-400/10 text-red-400',
  FlyingWyvern:    'bg-sky-400/10 text-sky-400',
  BruteWyvern:     'bg-red-400/10 text-red-400',
  FangedBeast:     'bg-orange-400/10 text-orange-400',
  Temnoceran:      'bg-rose-400/10 text-rose-400',
  BirdWyvern:      'bg-lime-400/10 text-lime-400',
  Construct:       'bg-stone-400/10 text-stone-400',
  DemiElderDragon: 'bg-amber-600/10 text-amber-600',
};

export const ELEMENT_COLORS: Record<string, string> = {
  Fire:      'text-red-500',
  Water:     'text-blue-500',
  Thunder:   'text-yellow-400',
  Ice:       'text-cyan-400',
  Dragon:    'text-teal-500',
  Poison:    'text-fuchsia-500',
  Sleep:     'text-blue-500',
  Paralysis: 'text-yellow-500',
  Blast:     'text-orange-500',
  Stun:      'text-amber-400',
};

export const DIFFICULTY_CLASSES: Record<string, string> = {
  Beginner:     'bg-green-500/10 text-green-500',
  Intermediate: 'bg-amber-500/10 text-amber-500',
  Advanced:     'bg-red-500/10 text-red-500',
};

export const DROP_METHOD_NAMES: Record<string, string> = {
  BodyCarve:      'Body Carve',
  TailCarve:      'Tail Carve',
  BreakReward:    'Break Reward',
  CaptureReward:  'Capture Reward',
  QuestReward:    'Quest Reward',
  ShinyDrop:      'Shiny Drop',
  WoundDrop:      'Wound Drop',
  PalicoBoomerang: 'Palico Boomerang',
};
