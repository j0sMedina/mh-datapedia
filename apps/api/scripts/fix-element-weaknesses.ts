import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// Source: Fextralife Monster Hunter Wilds wiki, community-verified in-game data.
// Format per monster: [fire, water, thunder, ice, dragon]
// 1 = ★  2 = ★★  null = immune  0 = no notable weakness (not stored)
type E = 0 | 1 | 2 | null;
const I: E = null;

const ELEMENTS = ['Fire', 'Water', 'Thunder', 'Ice', 'Dragon'] as const;

const DATA: Record<string, [E, E, E, E, E]> = {
  //                                     Fire  Water Thunder Ice Dragon
  'Ajarakan':                 [I,    2,    1,     1,   1  ],
  'Arkveld':                  [1,    1,    1,     1,   1  ],
  'Balahara':                 [1,    I,    1,     1,   1  ],
  'Blangonga':                [1,    1,    1,     I,   I  ],
  'Chatacabra':               [1,    1,    2,     1,   I  ],
  'Congalala':                [1,    1,    1,     1,   1  ],
  'Doshaguma':                [1,    1,    1,     1,   1  ],
  'Gore Magala':              [1,    I,    1,     1,   1  ],
  'Gogmazios':                [1,    I,    I,     I,   2  ],
  'Gravios':                  [I,    2,    1,     1,   1  ],
  'Guardian Arkveld':         [1,    1,    1,     1,   1  ],
  'Guardian Doshaguma':       [2,    1,    1,     2,   1  ],
  'Guardian Ebony Odogaron':  [2,    2,    2,     2,   1  ],
  'Guardian Fulgur Anjanath': [1,    2,    I,     2,   1  ],
  'Guardian Rathalos':        [I,    1,    1,     1,   2  ],
  'Gypceros':                 [2,    1,    I,     1,   1  ],
  'Hirabami':                 [1,    1,    1,     I,   1  ],
  'Jin Dahaad':               [1,    1,    1,     I,   1  ],
  'Lala Barina':              [1,    I,    1,     1,   I  ],
  'Lagiacrus':                [1,    I,    2,     1,   2  ],
  'Mizutsune':                [1,    I,    2,     1,   2  ],
  'Nerscylla':                [1,    I,    I,     1,   I  ],
  'Nu Udra':                  [I,    1,    1,     1,   1  ],
  'Omega Planetes':           [I,    1,    2,     1,   2  ],
  'Quematrice':               [I,    1,    1,     1,   1  ],
  'Rathalos':                 [I,    1,    1,     1,   2  ],
  'Rathian':                  [I,    1,    1,     1,   2  ],
  'Rey Dau':                  [1,    1,    I,     1,   1  ],
  'Rompopolo':                [1,    1,    1,     1,   1  ],
  'Seregios':                 [1,    1,    1,     2,   I  ],
  'Uth Duna':                 [1,    I,    1,     1,   1  ],
  'Xu Wu':                    [1,    1,    1,     2,   I  ],
  'Yian Kut-Ku':              [1,    1,    2,     1,   I  ],
  'Zoh Shia':                 [1,    1,    1,     1,   1  ],
};

async function main() {
  const monsters = await prisma.monster.findMany({ select: { id: true, name: true } });
  console.log(`Fixing element weaknesses for ${monsters.length} monsters...`);

  let fixed = 0;
  let skipped = 0;

  for (const monster of monsters) {
    const row = DATA[monster.name];
    if (!row) {
      console.warn(`  WARN: no element data for "${monster.name}" — skipped`);
      skipped++;
      continue;
    }

    const entries = ELEMENTS
      .map((el, i) => {
        const val = row[i];
        if (val === 0) return null; // no notable interaction — don't store
        return {
          monsterId: monster.id,
          element:   el as string,
          rating:    val === null ? 0 : val,
          isImmune:  val === null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    await prisma.$transaction(async (tx) => {
      // Delete only the 5 physical elements — preserve status rows (Poison/Sleep/Paralysis/Blast/Stun)
      await tx.elementWeakness.deleteMany({
        where: { monsterId: monster.id, element: { in: [...ELEMENTS] } },
      });
      if (entries.length > 0) {
        await tx.elementWeakness.createMany({ data: entries });
      }
    });

    console.log(`  ✓ ${monster.name}`);
    fixed++;
  }

  console.log(`\nDone. ${fixed} fixed, ${skipped} skipped.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
