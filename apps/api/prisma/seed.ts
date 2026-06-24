import { PrismaClient, MHGame, MonsterType, Element, DropMethod, Rank } from '@prisma/client';

const prisma = new PrismaClient();

type WeaknessEntry = { element: Element; rating: 0 | 1 | 2 | 3; isImmune?: boolean };
type DropEntry = { game: MHGame; rank: Rank; method: DropMethod; itemName: string; quantity: number; rate: number; part?: string };
type HitzoneEntry = { part: string };
type GameEntry = { game: MHGame; isNew: boolean };

interface MonsterSeed {
  name: string;
  title: string;
  description: string;
  type: MonsterType;
  isBoss: boolean;
  habitats: string[];
  parentName?: string;
  games: GameEntry[];
  weaknesses: WeaknessEntry[];
  hitzones: HitzoneEntry[];
  drops: DropEntry[];
}

function largeDrops(name: string, games: GameEntry[]): DropEntry[] {
  const drops: DropEntry[] = [];
  for (const { game } of games) {
    const isMR = game === 'MONSTER_HUNTER_WORLD_ICEBORNE' || game === 'MONSTER_HUNTER_RISE_SUNBREAK';
    const isWilds = game === 'MONSTER_HUNTER_WILDS';
    const ranks: Rank[] = isMR
      ? ['LowRank', 'HighRank', 'MasterRank']
      : ['LowRank', 'HighRank'];
    for (const rank of ranks) {
      const suffix = rank === 'LowRank' ? '' : rank === 'HighRank' ? '+' : ' Shard';
      drops.push({ game, rank, method: 'BodyCarve', itemName: `${name} Scale${suffix}`, quantity: 1, rate: 40 });
      drops.push({ game, rank, method: 'QuestReward', itemName: `${name} Scale${suffix}`, quantity: 1, rate: 45 });
    }
    if (isWilds) {
      drops.push({ game, rank: 'HighRank', method: 'WoundDrop', itemName: `${name} Fragment`, quantity: 1, rate: 50, part: 'Head Wound' });
      drops.push({ game, rank: 'HighRank', method: 'PalicoBoomerang', itemName: `${name} Scale`, quantity: 1, rate: 30 });
    }
  }
  return drops;
}

function smallDrops(name: string, games: GameEntry[]): DropEntry[] {
  return games.map(({ game }) => ({
    game,
    rank: 'LowRank' as Rank,
    method: 'QuestReward' as DropMethod,
    itemName: `${name} Hide`,
    quantity: 1,
    rate: 50,
  }));
}

const W = 'MONSTER_HUNTER_WORLD' as MHGame;
const WI = 'MONSTER_HUNTER_WORLD_ICEBORNE' as MHGame;
const R = 'MONSTER_HUNTER_RISE' as MHGame;
const S = 'MONSTER_HUNTER_RISE_SUNBREAK' as MHGame;
const WL = 'MONSTER_HUNTER_WILDS' as MHGame;

const MONSTERS: MonsterSeed[] = [

  // MONSTER HUNTER WORLD / ICEBORNE

  {
    name: 'Rathalos',
    title: 'King of the Skies',
    description: 'A flying wyvern known as the "King of the Skies." It nests in high places and patrols a wide territory. It uses its fiery breath and aerial mobility to dominate the skies.',
    type: 'Large', firstGame: W, firstYear: 2004, isBoss: true,
    habitats: ['Ancient Forest', 'Elder Recess', 'Wildspire Waste'],
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: WL, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Rathalos', [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: WL, isNew: false }]),
  },
  {
    name: 'Azure Rathalos',
    title: 'Blue Sky King',
    description: 'A subspecies of Rathalos with azure scales. Faster and more agile than the standard Rathalos, it excels at aerial combat.',
    type: 'Large', firstGame: W, firstYear: 2004, isBoss: false,
    habitats: ['Ancient Forest', 'Elder Recess'],
    parentName: 'Rathalos',
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Ice', rating: 2 }, { element: 'Thunder', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Azure Rathalos', [{ game: W, isNew: false }, { game: WI, isNew: false }]),
  },
  {
    name: 'Rathian',
    title: 'Queen of the Land',
    description: 'The female counterpart of Rathalos, known as the "Queen of the Land." Unlike Rathalos, Rathian prefers to fight on the ground.',
    type: 'Large', firstGame: W, firstYear: 2004, isBoss: false,
    habitats: ['Ancient Forest', 'Wildspire Waste'],
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Rathian', [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }]),
  },
  {
    name: 'Pink Rathian',
    title: 'Female Fire Wyvern',
    description: 'A subspecies of Rathian with vivid pink scales. More aggressive than its common counterpart and commands stronger poison.',
    type: 'Large', firstGame: W, firstYear: 2004, isBoss: false,
    habitats: ['Ancient Forest', 'Coral Highlands'],
    parentName: 'Rathian',
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }, { element: 'Fire', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Pink Rathian', [{ game: W, isNew: false }, { game: WI, isNew: false }]),
  },
  {
    name: 'Gold Rathian',
    title: 'Golden Female Fire Wyvern',
    description: 'A rare Rathian subspecies covered in golden scales that are harder than steel. Its poison is particularly virulent.',
    type: 'Large', firstGame: WI, firstYear: 2004, isBoss: false,
    habitats: ['Hoarfrost Reach', 'Elder Recess'],
    parentName: 'Rathian',
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Gold Rathian', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Silver Rathalos',
    title: 'Silver Fire Wyvern',
    description: 'A rare Rathalos subspecies with silver scales that reflect light brilliantly. Considered the pinnacle of aerial predators.',
    type: 'Large', firstGame: WI, firstYear: 2004, isBoss: false,
    habitats: ['Elder Recess', 'Ancient Forest'],
    parentName: 'Rathalos',
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Silver Rathalos', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Anjanath',
    title: 'Anja Wyvern',
    description: 'A Bird Wyvern that stalks the Ancient Forest. Its powerful nose can detect prey from great distances, and it breathes fire hot enough to melt rock.',
    type: 'Large', firstGame: W, firstYear: 2018, isBoss: true,
    habitats: ['Ancient Forest'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }, { element: 'Thunder', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Anjanath', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Fulgur Anjanath',
    title: 'Thunderous Anja Wyvern',
    description: 'A subspecies of Anjanath that has adapted to cold climates and developed the ability to channel thunder through its body.',
    type: 'Large', firstGame: WI, firstYear: 2019, isBoss: false,
    habitats: ['Hoarfrost Reach', 'Ancient Forest'],
    parentName: 'Anjanath',
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }, { element: 'Dragon', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Fulgur Anjanath', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Nergigante',
    title: 'Destroyer of All',
    description: 'An Elder Dragon that appears when other elder dragons are in the vicinity. It hunts and consumes other elder dragons to survive.',
    type: 'ElderDragon', firstGame: W, firstYear: 2018, isBoss: true,
    habitats: ['Elder Recess'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Nergigante', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Ruiner Nergigante',
    title: 'Raging Destroyer',
    description: 'A variant of Nergigante that has grown even more savage. Its spikes regrow differently, creating asymmetrical and lethal patterns.',
    type: 'ElderDragon', firstGame: WI, firstYear: 2019, isBoss: false,
    habitats: ['Elder Recess'],
    parentName: 'Nergigante',
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Ruiner Nergigante', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Teostra',
    title: 'Flame King Dragon',
    description: 'A brutal Elder Dragon that commands flame and leaves scorched earth in its wake. Its body generates explosive powder.',
    type: 'ElderDragon', firstGame: W, firstYear: 2006, isBoss: true,
    habitats: ['Elder Recess', 'Wildspire Waste'],
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Teostra', [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }]),
  },
  {
    name: 'Kushala Daora',
    title: 'Steel Dragon',
    description: 'An Elder Dragon with metallic scales that generate wind barriers around its body. It can create powerful gales to repel attackers.',
    type: 'ElderDragon', firstGame: W, firstYear: 2006, isBoss: true,
    habitats: ['Elder Recess', 'Ancient Forest'],
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Kushala Daora', [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }]),
  },
  {
    name: 'Vaal Hazak',
    title: 'Corpse Valley Elder Dragon',
    description: 'An Elder Dragon that inhabits the Rotten Vale. It uses the effluvium in the vale to reanimate corpses and enhance its own power.',
    type: 'ElderDragon', firstGame: W, firstYear: 2018, isBoss: true,
    habitats: ['Rotten Vale'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Vaal Hazak', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Blackveil Vaal Hazak',
    title: 'Veil of the Abyss',
    description: 'A variant of Vaal Hazak that has become even more saturated with effluvium, developing a distinctive veil-like growth.',
    type: 'ElderDragon', firstGame: WI, firstYear: 2019, isBoss: false,
    habitats: ['Rotten Vale'],
    parentName: 'Vaal Hazak',
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Blackveil Vaal Hazak', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Velkhana',
    title: 'Ice Dragon',
    description: 'An Elder Dragon with the ability to freeze anything in its path. Its breath can cover the surrounding area in thick ice in an instant.',
    type: 'ElderDragon', firstGame: WI, firstYear: 2019, isBoss: true,
    habitats: ['Hoarfrost Reach', 'Elder Recess'],
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Ice', rating: 0, isImmune: true }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Velkhana', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Namielle',
    title: 'Abyssal Hydrolance Dragon',
    description: 'An Elder Dragon that manipulates water and lightning. Its trailing veil absorbs moisture and can unleash devastating electrical discharges.',
    type: 'ElderDragon', firstGame: WI, firstYear: 2019, isBoss: true,
    habitats: ['Coral Highlands'],
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }, { element: 'Dragon', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Namielle', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Shara Ishvalda',
    title: 'Repose of Power',
    description: "An Elder Dragon that manipulates the earth's vibrations. The true form hidden beneath its rocky exterior is otherworldly in appearance.",
    type: 'ElderDragon', firstGame: WI, firstYear: 2019, isBoss: true,
    habitats: ['Origin Isle'],
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Thunder', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Shara Ishvalda', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Fatalis',
    title: 'Black Dragon',
    description: 'A legendary black dragon spoken of in ancient texts. Civilization-ending power is said to reside within its body. Even ancient records speak of entire kingdoms falling to its wrath.',
    type: 'ElderDragon', firstGame: WI, firstYear: 2004, isBoss: true,
    habitats: ['Castle Schrade'],
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Water', rating: 2 }, { element: 'Thunder', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Fatalis', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Zinogre',
    title: 'Thunder Wolf Wyvern',
    description: 'A Fanged Wyvern that channels lightning through its body by harnessing Thunderbugs. When fully charged, its power is awe-inspiring.',
    type: 'Large', firstGame: WI, firstYear: 2010, isBoss: true,
    habitats: ['Hoarfrost Reach', 'Ancient Forest'],
    games: [{ game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Ice', rating: 3 }, { element: 'Water', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Zinogre', [{ game: WI, isNew: false }, { game: R, isNew: false }, { game: S, isNew: false }]),
  },
  {
    name: 'Stygian Zinogre',
    title: 'Hell Thunder Wolf Wyvern',
    description: 'A subspecies of Zinogre that harnesses Dragon element rather than Thunder, giving it a sinister crimson aura when fully charged.',
    type: 'Large', firstGame: WI, firstYear: 2012, isBoss: false,
    habitats: ['Rotten Vale'],
    parentName: 'Zinogre',
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Ice', rating: 2 }, { element: 'Water', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Stygian Zinogre', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Brachydios',
    title: 'Explosive Scale Wyvern',
    description: 'A Brute Wyvern that uses a special slime mold to create powerful explosions. It primes surfaces with its glowing forelimbs before detonating them.',
    type: 'Large', firstGame: WI, firstYear: 2012, isBoss: true,
    habitats: ['Elder Recess'],
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Ice', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Brachydios', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Rajang',
    title: 'Golden Thunder Ape',
    description: 'A violent Fanged Beast feared even by Elder Dragons. In its powered-up golden state, it becomes one of the most dangerous creatures in the world.',
    type: 'Large', firstGame: WI, firstYear: 2003, isBoss: true,
    habitats: ['Hoarfrost Reach', 'Elder Recess'],
    games: [{ game: WI, isNew: false }, { game: R, isNew: false }],
    weaknesses: [{ element: 'Ice', rating: 3 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Rajang', [{ game: WI, isNew: false }, { game: R, isNew: false }]),
  },
  {
    name: 'Barioth',
    title: 'Snow Flying Wyvern',
    description: 'A Flying Wyvern adapted to arctic environments. Its saber-like tusks and spined tail help it move gracefully across ice and snow.',
    type: 'Large', firstGame: WI, firstYear: 2009, isBoss: false,
    habitats: ['Hoarfrost Reach'],
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Barioth', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Tigrex',
    title: 'Roaring Wyvern',
    description: 'A primitive Flying Wyvern whose powerful roars cause physical shockwaves. One of the oldest known species of Flying Wyvern.',
    type: 'Large', firstGame: WI, firstYear: 2007, isBoss: false,
    habitats: ['Hoarfrost Reach', 'Ancient Forest'],
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Water', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Tigrex', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Nargacuga',
    title: 'Swift Black Shadow',
    description: 'A panther-like Flying Wyvern with jet-black scales. It moves with blinding speed and can launch its tail spines as projectiles.',
    type: 'Large', firstGame: WI, firstYear: 2008, isBoss: false,
    habitats: ['Ancient Forest'],
    games: [{ game: WI, isNew: false }, { game: R, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Nargacuga', [{ game: WI, isNew: false }, { game: R, isNew: false }]),
  },
  {
    name: 'Glavenus',
    title: 'Acidic Sword Wyvern',
    description: 'A Brute Wyvern with a massive bladed tail it sharpens on its teeth. It can heat its tail to incandescent temperatures for devastating strikes.',
    type: 'Large', firstGame: WI, firstYear: 2015, isBoss: true,
    habitats: ['Ancient Forest', 'Wildspire Waste'],
    games: [{ game: WI, isNew: false }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Glavenus', [{ game: WI, isNew: false }]),
  },
  {
    name: 'Acidic Glavenus',
    title: 'Corrosive Sword Wyvern',
    description: 'A Glavenus subspecies whose tail secretes a highly corrosive acid that can dissolve armor and equipment.',
    type: 'Large', firstGame: WI, firstYear: 2019, isBoss: false,
    habitats: ['Rotten Vale'],
    parentName: 'Glavenus',
    games: [{ game: WI, isNew: true }],
    weaknesses: [{ element: 'Ice', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Acidic Glavenus', [{ game: WI, isNew: true }]),
  },
  {
    name: 'Legiana',
    title: 'Wind Ruler',
    description: 'A Flying Wyvern that glides gracefully through the skies above the Coral Highlands. Its song can be heard across vast distances.',
    type: 'Large', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Coral Highlands'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Legiana', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Odogaron',
    title: 'Odogo Dragon',
    description: 'An extremely aggressive Fanged Wyvern found in the Rotten Vale. Its muscles are powerful enough to shred armor, and it rarely stops moving.',
    type: 'Large', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Rotten Vale'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }, { element: 'Ice', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Odogaron', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Bazelgeuse',
    title: 'Explosive Scale Wyvern',
    description: 'A Flying Wyvern that drops explosive scales as it flies. Its signature bombing runs can devastate an area in moments.',
    type: 'Large', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Wildspire Waste', 'Ancient Forest', 'Coral Highlands'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Ice', rating: 2 }, { element: 'Dragon', rating: 1 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Bazelgeuse', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },

  // MONSTER HUNTER RISE / SUNBREAK

  {
    name: 'Magnamalo',
    title: 'Principal Demon',
    description: 'A Fanged Wyvern that has absorbed Hellfire from fallen monsters. This fearsome beast is deeply connected to the history of Kamura Village.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: true,
    habitats: ['Shrine Ruins', 'Lava Caverns'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Magnamalo', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Scorned Magnamalo',
    title: 'Hateful Demon',
    description: 'A Magnamalo variant that has absorbed an extreme amount of Hellfire, pushing its power far beyond normal limits.',
    type: 'Large', firstGame: S, firstYear: 2022, isBoss: false,
    habitats: ['Shrine Ruins', 'Lava Caverns'],
    parentName: 'Magnamalo',
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Scorned Magnamalo', [{ game: S, isNew: true }]),
  },
  {
    name: 'Mizutsune',
    title: 'Fox Wyvern',
    description: 'A graceful Leviathan that coats itself in bubbles generated from its saliva. It moves with balletic elegance and can launch devastating bubble-based attacks.',
    type: 'Large', firstGame: R, firstYear: 2015, isBoss: true,
    habitats: ['Frost Islands', 'Flooded Forest'],
    games: [{ game: R, isNew: false }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Mizutsune', [{ game: R, isNew: false }, { game: S, isNew: false }]),
  },
  {
    name: 'Almudron',
    title: 'Mud Fish Wyvern',
    description: 'A Leviathan that manipulates golden mud to ensnare prey. It can bury itself completely in the earth and launch surprise attacks.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Flooded Forest', 'Sandy Plains'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Almudron', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Bishaten',
    title: 'Fruit-Throwing Fanged Beast',
    description: 'A Fanged Beast that uses its prehensile tail to gather and throw explosive or poisonous fruit at enemies.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Shrine Ruins', 'Flooded Forest'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Bishaten', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Blood Orange Bishaten',
    title: 'Scarlet Fruit-Throwing Fanged Beast',
    description: 'A Bishaten subspecies with deep orange fur. Its fruit arsenal focuses on explosive varieties with devastating area-of-effect blasts.',
    type: 'Large', firstGame: S, firstYear: 2022, isBoss: false,
    habitats: ['Jungle'],
    parentName: 'Bishaten',
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Blood Orange Bishaten', [{ game: S, isNew: true }]),
  },
  {
    name: 'Goss Harag',
    title: 'Ice-Blade Fanged Beast',
    description: 'A powerful Fanged Beast that summons blades of ice from its body to augment its already formidable melee attacks.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Frost Islands'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Goss Harag', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Aknosom',
    title: 'Cockatrice Wyvern',
    description: 'A Bird Wyvern that spreads its brilliant crest to intimidate rivals and regulate its body temperature. It can spit blazing-hot fire.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Sandy Plains'],
    games: [{ game: R, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Aknosom', [{ game: R, isNew: true }]),
  },
  {
    name: 'Somnacanth',
    title: 'Spiraling Dance Leviathan',
    description: 'A Leviathan that lures prey with a bioluminescent display before hypnotizing them with a sleep-inducing mist.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Flooded Forest'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Somnacanth', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Aurora Somnacanth',
    title: 'Freezing Dance Leviathan',
    description: 'A Somnacanth subspecies that generates intense cold rather than sleep mist. Its bioluminescent display shimmers with an icy blue light.',
    type: 'Large', firstGame: S, firstYear: 2022, isBoss: false,
    habitats: ['Frost Islands'],
    parentName: 'Somnacanth',
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Aurora Somnacanth', [{ game: S, isNew: true }]),
  },
  {
    name: 'Tetranadon',
    title: 'Swell Amphibian',
    description: 'An Amphibian that can swallow massive amounts of water or mud to inflate its body, dramatically changing its attack patterns.',
    type: 'Large', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Shrine Ruins', 'Flooded Forest'],
    games: [{ game: R, isNew: true }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Leg' }],
    drops: largeDrops('Tetranadon', [{ game: R, isNew: true }]),
  },
  {
    name: 'Chameleos',
    title: 'Mist Phantom Elder Dragon',
    description: 'An Elder Dragon that can turn invisible and steal items from hunters using its long tongue. It shrouds itself in a dense poison mist.',
    type: 'ElderDragon', firstGame: R, firstYear: 2006, isBoss: true,
    habitats: ['Flooded Forest'],
    games: [{ game: R, isNew: false }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Chameleos', [{ game: R, isNew: false }, { game: S, isNew: false }]),
  },
  {
    name: 'Wind Serpent Ibushi',
    title: 'Wind God Dragon',
    description: 'An Elder Dragon that controls wind and can generate powerful gusts from its body. Said to bring storms wherever it travels.',
    type: 'ElderDragon', firstGame: R, firstYear: 2021, isBoss: true,
    habitats: ['Shrine Ruins'],
    games: [{ game: R, isNew: true }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Wind Serpent Ibushi', [{ game: R, isNew: true }]),
  },
  {
    name: 'Thunder Serpent Narwa',
    title: 'Thunder God Dragon',
    description: 'An Elder Dragon that generates lightning from specialized organs. It and Ibushi are the forces driving the Rampage that threatens Kamura Village.',
    type: 'ElderDragon', firstGame: R, firstYear: 2021, isBoss: true,
    habitats: ['Shrine Ruins'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Thunder Serpent Narwa', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Lunagaron',
    title: 'Moon-Howling Wolf',
    description: 'A Fanged Wyvern that can generate ice from its own body, reinforcing itself with crystalline armor and launching ice projectiles.',
    type: 'Large', firstGame: S, firstYear: 2022, isBoss: true,
    habitats: ['Frost Islands', 'Citadel'],
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Lunagaron', [{ game: S, isNew: true }]),
  },
  {
    name: 'Malzeno',
    title: 'Bloodblight Elder Dragon',
    description: 'An Elder Dragon of legend that commands an army of Qurio parasites. It drains the vitality of its prey to grow even more powerful.',
    type: 'ElderDragon', firstGame: S, firstYear: 2022, isBoss: true,
    habitats: ['Citadel'],
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Malzeno', [{ game: S, isNew: true }]),
  },
  {
    name: 'Gaismagorm',
    title: 'Qurio Elder Dragon',
    description: 'An immense Elder Dragon that serves as the source of the Qurio parasites. Its body is a living colony of the creatures.',
    type: 'ElderDragon', firstGame: S, firstYear: 2022, isBoss: true,
    habitats: ['Underground Facility'],
    games: [{ game: S, isNew: true }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Gaismagorm', [{ game: S, isNew: true }]),
  },
  {
    name: 'Garangolm',
    title: 'Steel Body Fanged Beast',
    description: 'A Fanged Beast that absorbs moss and minerals through its pores, hardening its body over time into a near-impenetrable armor.',
    type: 'Large', firstGame: S, firstYear: 2012, isBoss: false,
    habitats: ['Jungle', 'Flooded Forest'],
    games: [{ game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Garangolm', [{ game: S, isNew: false }]),
  },
  {
    name: 'Gore Magala',
    title: 'Black Eclipse Wyvern',
    description: 'A wyvern shrouded in mystery that spreads the Frenzy Virus. It cannot see but perceives the world through specialized sensory organs.',
    type: 'Large', firstGame: S, firstYear: 2013, isBoss: true,
    habitats: ['Shrine Ruins', 'Citadel'],
    games: [{ game: S, isNew: false }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Gore Magala', [{ game: S, isNew: false }]),
  },
  {
    name: 'Espinas',
    title: 'Thorn-Back Wyvern',
    description: 'A Flying Wyvern that appears docile but reacts explosively when threatened. Its venomous thorns and explosive breath make it extremely dangerous when provoked.',
    type: 'Large', firstGame: S, firstYear: 2007, isBoss: false,
    habitats: ['Jungle'],
    games: [{ game: S, isNew: false }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Water', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Espinas', [{ game: S, isNew: false }]),
  },

  // MONSTER HUNTER WILDS

  {
    name: 'Rey Dau',
    title: 'Thunder Bolt Wyvern',
    description: 'A Flying Wyvern that channels electricity through its body. It deploys thunder-based attacks with terrifying precision and speed.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: true,
    habitats: ['Windward Plains'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Ice', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Rey Dau', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Arkveld',
    title: 'Imprisoned Elder Dragon',
    description: 'An Elder Dragon of immense power that was sealed away. Its chains still bind parts of its body, yet its strength is overwhelming.',
    type: 'ElderDragon', firstGame: WL, firstYear: 2025, isBoss: true,
    habitats: ['Unknown Territory'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Arkveld', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Jin Dahaad',
    title: 'Forge Lizard Wyvern',
    description: 'A Brute Wyvern that generates extreme heat in its body, using it to shape and hurl molten rock as weapons.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: false,
    habitats: ['Scarlet Forest'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Water', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Jin Dahaad', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Nu Udra',
    title: 'Abyssal Sea Dragon',
    description: 'An Elder Dragon that dwells in the deep ocean. Its bioluminescent body and immense tentacles can drag entire ships to the depths.',
    type: 'ElderDragon', firstGame: WL, firstYear: 2025, isBoss: true,
    habitats: ['Iceshard Cliffs'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Dragon', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Nu Udra', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Uth Duna',
    title: 'Tidal Wyvern',
    description: 'A massive Leviathan that commands the seas. It can summon tidal waves and manipulate ocean currents to overwhelm its enemies.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: false,
    habitats: ['Iceshard Cliffs'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Uth Duna', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Xu Wu',
    title: 'Phantom Cloud Dragon',
    description: 'A Flying Wyvern that generates dense mist from its body to disorient prey before striking with lethal precision.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: false,
    habitats: ['Scarlet Forest'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Thunder', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Xu Wu', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Lala Barina',
    title: 'Toxic Dancer Wyvern',
    description: 'A Bird Wyvern that uses an elaborate display of its colorful feathers to disorient prey before delivering a toxic attack.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: false,
    habitats: ['Windward Plains'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Fire', rating: 3 }, { element: 'Dragon', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Lala Barina', [{ game: WL, isNew: true }]),
  },
  {
    name: 'Doshaguma',
    title: 'Pack King',
    description: 'A Fanged Beast that leads massive packs of monsters. When alone it is manageable; with its pack it becomes a terrifying force of destruction.',
    type: 'Large', firstGame: WL, firstYear: 2025, isBoss: true,
    habitats: ['Windward Plains'],
    games: [{ game: WL, isNew: true }],
    weaknesses: [{ element: 'Thunder', rating: 3 }, { element: 'Fire', rating: 2 }],
    hitzones: [{ part: 'Head' }, { part: 'Body' }, { part: 'Tail' }, { part: 'Wing' }, { part: 'Leg' }],
    drops: largeDrops('Doshaguma', [{ game: WL, isNew: true }]),
  },

  // SMALL MONSTERS (no hitzones or weaknesses)

  {
    name: 'Jagras',
    title: 'Pack Jagras',
    description: 'A small fanged wyvern that travels in packs under the command of the Great Jagras. They swarm prey together to overwhelm larger targets.',
    type: 'Small', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Ancient Forest'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [],
    hitzones: [],
    drops: smallDrops('Jagras', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Girros',
    title: 'Paralysis Lizard',
    description: 'A small raptor-like creature that uses paralysis-inducing bites. Commanded by the Great Girros, they hunt in coordinated packs.',
    type: 'Small', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Rotten Vale'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [],
    hitzones: [],
    drops: smallDrops('Girros', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Kestodon',
    title: 'Headbutt Pachycephalosaurus',
    description: 'A herbivorous creature that headbutts threats when disturbed. The males have larger crests used for combat and display.',
    type: 'Small', firstGame: W, firstYear: 2018, isBoss: false,
    habitats: ['Wildspire Waste'],
    games: [{ game: W, isNew: true }, { game: WI, isNew: false }],
    weaknesses: [],
    hitzones: [],
    drops: smallDrops('Kestodon', [{ game: W, isNew: true }, { game: WI, isNew: false }]),
  },
  {
    name: 'Izuchi',
    title: 'Pack Weasel Wyvern',
    description: 'Small fanged wyverns that travel in groups led by a Great Izuchi. Their coordinated attacks make them more dangerous than their size suggests.',
    type: 'Small', firstGame: R, firstYear: 2021, isBoss: false,
    habitats: ['Shrine Ruins'],
    games: [{ game: R, isNew: true }, { game: S, isNew: false }],
    weaknesses: [],
    hitzones: [],
    drops: smallDrops('Izuchi', [{ game: R, isNew: true }, { game: S, isNew: false }]),
  },
  {
    name: 'Bnahabra',
    title: 'Giant Insect',
    description: 'A large insect-type monster that travels in swarms. Their stingers can inflict various status ailments depending on the subspecies.',
    type: 'Small', firstGame: W, firstYear: 2012, isBoss: false,
    habitats: ['Ancient Forest', 'Wildspire Waste', 'Coral Highlands'],
    games: [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }],
    weaknesses: [],
    hitzones: [],
    drops: smallDrops('Bnahabra', [{ game: W, isNew: false }, { game: WI, isNew: false }, { game: R, isNew: false }]),
  },
];

async function main() {
  console.log('Starting seed...');

  const monsterIds = new Map<string, string>();

  for (const m of MONSTERS) {
    const monster = await prisma.monster.upsert({
      where: { name: m.name },
      update: {},
      create: {
        name: m.name,
        title: m.title,
        description: m.description,
        type: m.type,
        isBoss: m.isBoss,
        habitats: m.habitats,
      },
    });
    monsterIds.set(m.name, monster.id);
    console.log(`  + ${m.name}`);
  }

  for (const m of MONSTERS) {
    const monsterId = monsterIds.get(m.name)!;

    if (m.parentName) {
      const parentId = monsterIds.get(m.parentName);
      if (parentId) {
        await prisma.monster.update({ where: { id: monsterId }, data: { parentId } });
      }
    }

    for (const w of m.weaknesses) {
      await prisma.elementWeakness.upsert({
        where: { monsterId_element: { monsterId, element: w.element } },
        update: { rating: w.rating, isImmune: w.isImmune ?? false },
        create: { monsterId, element: w.element, rating: w.rating, isImmune: w.isImmune ?? false },
      });
    }

    for (const h of m.hitzones) {
      await prisma.hitzone.upsert({
        where: { monsterId_part: { monsterId, part: h.part } },
        update: {},
        create: { monsterId, part: h.part },
      });
    }

    for (const d of m.drops) {
      await prisma.monsterDrop.create({
        data: {
          monsterId,
          game: d.game,
          rank: d.rank,
          method: d.method,
          itemName: d.itemName,
          quantity: d.quantity,
          rate: d.rate,
          part: d.part ?? null,
        },
      });
    }
  }

  console.log(`\nSeed complete: ${MONSTERS.length} monsters seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
