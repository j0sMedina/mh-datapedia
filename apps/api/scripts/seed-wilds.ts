import { PrismaClient } from '@prisma/client';
import type { MonsterType, DropMethod, Rank, MHGame } from '@prisma/client';
import 'dotenv/config';

// PrismaClient is the object that talks to the database.
// We create one instance and reuse it for the whole script.
const prisma = new PrismaClient();

const API_BASE = 'https://wilds.mhdb.io/en';

// Maps the species string from the Wilds API to the MonsterType enum value in our DB.
// Example: the API returns "flying-wyvern", we store "FlyingWyvern".
const SPECIES_MAP: Record<string, MonsterType> = {
  'flying-wyvern': 'FlyingWyvern',
  'brute-wyvern':  'BruteWyvern',
  'fanged-beast':  'FangedBeast',
  'temnoceran':    'Temnoceran',
  'bird-wyvern':   'BirdWyvern',
  'construct':     'Construct',
  'demi-elder':    'DemiElderDragon',
  'elder-dragon':  'ElderDragon',
  'leviathan':     'Leviathan',
  'amphibian':     'Amphibian',
  'cephalopod':    'Cephalopod',
  'machine':       'Machine',
};

// Maps the weakness/element string from the API to the Element enum in our DB.
// "blastblight" from the API becomes "Blast" in our schema.
// The API uses "element", "status", or "effect" fields on each weakness object.
// NOTE: "flash", "exhaust", "noise" are combat effects, not stored elements — they are correctly skipped.
const ELEMENT_MAP: Record<string, string> = {
  'fire':        'Fire',
  'water':       'Water',
  'thunder':     'Thunder',
  'ice':         'Ice',
  'dragon':      'Dragon',
  'poison':      'Poison',
  'sleep':       'Sleep',
  'paralysis':   'Paralysis',
  'blastblight': 'Blast',
  'stun':        'Stun',
};

// Maps the reward condition type from the API to our DropMethod enum.
// Wilds has additional carve types (rotten, crystallized, severed) that map to BodyCarve.
// "wound-destroyed" is a new Wilds mechanic that maps to WoundDrop.
const METHOD_MAP: Record<string, DropMethod> = {
  'carve':                    'BodyCarve',
  'carve-rotten':             'BodyCarve',    // Wilds: rotten flesh carve (same result as body carve)
  'carve-crystallized':       'BodyCarve',    // Wilds: crystallized state carve
  'carve-severed':            'TailCarve',    // Wilds: severed part carve — treat as TailCarve
  'carve-rotten-severed':     'TailCarve',    // Wilds: rotten severed part carve
  'broken-part':              'BreakReward',
  'broken-fragment':          'BreakReward',  // Wilds: fragment from breaking a part (Gogmazios)
  'capture':                  'CaptureReward',
  'target-reward':            'QuestReward',
  'shiny-drop':               'ShinyDrop',
  'wound-drop':               'WoundDrop',
  'wound-destroyed':          'WoundDrop',    // Wilds: wound-destroyed is a type of wound drop
  'tempered-wound-destroyed': 'WoundDrop',    // Wilds: tempered version of wound-destroyed
};

// Maps the rank string from the API to our Rank enum.
const RANK_MAP: Record<string, Rank> = {
  'low':  'LowRank',
  'high': 'HighRank',
};

// Combat effects (not elements/statuses) that should be skipped when processing weaknesses.
// "flash", "exhaust", "noise" are environmental or support effects, not stored element weaknesses.
const KNOWN_SKIPPED_EFFECTS = new Set(['flash', 'exhaust', 'noise']);

// Fetches the full list of monsters from the Wilds API.
// Returns an array of objects with at least { id: number, name: string }.
async function fetchMonsterList(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/monsters`);
  if (!res.ok) throw new Error(`Failed to fetch monster list: ${res.status} ${res.statusText}`);
  return res.json();
}

// Fetches one monster's full data including weaknesses, parts (hitzones), and rewards (drops).
async function fetchMonsterDetail(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/monsters/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch monster ${id}: ${res.status} ${res.statusText}`);
  return res.json();
}

// Extracts the element/status/effect key from a weakness object.
// The Wilds API uses different field names depending on the weakness type:
//   { element: "fire", kind: "element", ... }
//   { status: "paralysis", kind: "status", ... }
//   { effect: "stun", kind: "effect", ... }
function getWeaknessKey(w: any): string | undefined {
  return w.element ?? w.status ?? w.effect;
}

async function main() {
  console.log('Fetching monster list from wilds.mhdb.io...');
  const list = await fetchMonsterList();
  console.log(`  API returned ${list.length} monsters`);

  // Build a Set of monster names from the API so we can delete DB entries that are not in it.
  // A Set is like an array but with very fast "does this value exist?" lookups.
  const apiNames = new Set<string>(list.map((m: any) => m.name as string));

  let upserted = 0;

  for (const listItem of list) {
    // Fetch the full detail for this monster (includes weaknesses, parts, rewards)
    const m = await fetchMonsterDetail(listItem.id);

    // Map the API's species string to our MonsterType. Default to 'Large' with a warning
    // if the species is unrecognised — this means the API added a new species we haven't mapped.
    const type: MonsterType = SPECIES_MAP[m.species] ?? 'Large';
    if (!SPECIES_MAP[m.species]) {
      console.warn(`  WARN: unknown species "${m.species}" for ${m.name} — stored as Large`);
    }

    // Use a Prisma transaction so all updates for one monster succeed or fail together.
    // If anything throws inside here, Prisma rolls back ALL changes for this monster.
    await prisma.$transaction(async (tx) => {

      // upsert = UPDATE if the name already exists, CREATE if it doesn't.
      // We match by name (the unique constraint on Monster.name).
      const monster = await tx.monster.upsert({
        where: { name: m.name },
        create: {
          name:        m.name,
          title:       '',
          description: m.description ?? '',
          type,
          isBoss:      m.kind === 'large',
          imageUrl:    null,
          iconUrl:     null,
          habitats:    [],
        },
        update: {
          type,
          isBoss:      m.kind === 'large',
          description: m.description ?? '',
        },
        select: { id: true },
      });

      // ── WEAKNESSES ──────────────────────────────────────────────────────────
      // Delete all existing weakness rows for this monster, then insert fresh ones.
      // This is the "replace all" pattern — simpler than trying to diff each row.
      await tx.elementWeakness.deleteMany({ where: { monsterId: monster.id } });

      // The API weakness objects use "element", "status", or "effect" depending on type.
      // We unify them all through ELEMENT_MAP. Entries not in the map (e.g. flash, exhaust,
      // noise) are correctly skipped — they are combat effects, not stored element weaknesses.
      // We also deduplicate by element since ElementWeakness has a unique constraint
      // on (monsterId, element) — if the API returns the same element twice, keep the highest level.
      const weaknessMap = new Map<string, { monsterId: string; element: string; rating: number; isImmune: boolean }>();

      for (const w of (m.weaknesses ?? [])) {
        const key = getWeaknessKey(w);
        const element = key ? ELEMENT_MAP[key] : undefined;
        if (!element) {
          if (key && !KNOWN_SKIPPED_EFFECTS.has(key)) {
            console.warn(`  WARN: unknown element/status/effect "${key}" for ${m.name} — skipped`);
          }
          continue;
        }
        const existing = weaknessMap.get(element);
        if (!existing || w.level > existing.rating) {
          weaknessMap.set(element, {
            monsterId: monster.id,
            element,
            rating:   w.level,
            isImmune: false,
          });
        }
      }

      // Resistances = element immunities (e.g. Rathalos immune to Fire).
      // Only element-kind resistances are stored — effect resistances (noise, flash, exhaust) are skipped.
      for (const r of (m.resistances ?? [])) {
        if (r.kind !== 'element') continue;
        const element = r.element ? ELEMENT_MAP[r.element] : undefined;
        if (!element) continue;
        // Only add immunity if this element isn't already listed as a weakness
        if (!weaknessMap.has(element)) {
          weaknessMap.set(element, {
            monsterId: monster.id,
            element,
            rating:   0,
            isImmune: true,
          });
        }
      }

      const weaknesses = Array.from(weaknessMap.values());
      if (weaknesses.length > 0) {
        await tx.elementWeakness.createMany({ data: weaknesses });
      }

      // ── HITZONES ────────────────────────────────────────────────────────────
      // Same replace-all pattern as weaknesses.
      // The API calls them "parts"; we call them "hitzones".
      // Each part has a "multipliers" object with damage multiplier values (0.0–1.0).
      // We multiply by 100 to store as integers (our schema uses Int for all columns).
      //
      // The API can return multiple parts with the same name (e.g. three "hide" entries).
      // Our schema has a unique constraint on (monsterId, part), so we deduplicate by
      // averaging the multipliers across duplicate parts.
      await tx.hitzone.deleteMany({ where: { monsterId: monster.id } });

      // Group parts by name and average their multipliers to handle duplicates.
      const partGroups = new Map<string, any[]>();
      for (const p of (m.parts ?? [])) {
        const name = p.part as string;
        if (!partGroups.has(name)) partGroups.set(name, []);
        partGroups.get(name)!.push(p);
      }

      const hitzones = Array.from(partGroups.entries()).map(([partName, parts]) => {
        // Average across duplicate parts, then multiply by 100 to convert to integer.
        const avg = (key: string) =>
          Math.round(
            (parts.reduce((sum: number, p: any) => sum + (p.multipliers[key] ?? 0), 0) / parts.length) * 100
          );
        return {
          monsterId: monster.id,
          part:      partName,
          cut:       avg('slash'),
          blunt:     avg('blunt'),
          bullet:    avg('pierce'),
          fire:      avg('fire'),
          water:     avg('water'),
          thunder:   avg('thunder'),
          ice:       avg('ice'),
          dragon:    avg('dragon'),
          stun:      avg('stun'),
        };
      });

      if (hitzones.length > 0) {
        await tx.hitzone.createMany({ data: hitzones });
      }

      // ── DROPS ───────────────────────────────────────────────────────────────
      // The API returns rewards as: [{ item: { name }, conditions: [{ kind, rank, quantity, chance, part }] }]
      // We expand each reward × each condition into one DB row.
      // "chance" is the drop chance percentage (e.g. 35 means 35%).
      // Build the drops array FIRST so that if every condition is unknown we don't
      // wipe existing data and commit zero rows — the delete only runs once we know
      // what we are going to insert.
      const drops: object[] = [];

      for (const reward of (m.rewards ?? [])) {
        for (const cond of (reward.conditions ?? [])) {

          const method: DropMethod | undefined = METHOD_MAP[cond.kind];

          if (!method) {
            console.warn(`  WARN: unknown drop kind "${cond.kind}" for ${m.name} — skipped`);
            continue;
          }

          const rank: Rank | undefined = RANK_MAP[cond.rank];
          if (!rank) {
            console.warn(`  WARN: unknown rank "${cond.rank}" for ${m.name} — skipped`);
            continue;
          }

          drops.push({
            monsterId: monster.id,
            game:      'MONSTER_HUNTER_WILDS' as MHGame,
            rank,
            method,
            part:      cond.part ?? null,    // the body part this drop comes from (nullable)
            itemName:  reward.item.name,
            quantity:  cond.quantity,
            rate:      cond.chance,           // drop chance as a percentage, e.g. 35.0
          });
        }
      }

      // Only replace existing drops now that we know what the new set looks like.
      await tx.monsterDrop.deleteMany({ where: { monsterId: monster.id } });
      if (drops.length > 0) {
        await tx.monsterDrop.createMany({ data: drops });
      }
    }); // end transaction

    upserted++;
    console.log(`  [${upserted}/${list.length}] ✓ ${m.name}`);
  }

  // Delete all monsters whose name is NOT in the Wilds API.
  // Runs AFTER the loop so the DB is never left in a torn state if a fetch fails mid-loop.
  // onDelete: Cascade in the schema means all their weaknesses, hitzones, and drops
  // are also deleted automatically.
  const deleted = await prisma.monster.deleteMany({
    where: { name: { notIn: Array.from(apiNames) } },
  });
  console.log(`  Deleted ${deleted.count} non-Wilds monsters from the DB`);

  console.log(`\nDone. ${upserted} monsters upserted, ${deleted.count} non-Wilds monsters deleted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
