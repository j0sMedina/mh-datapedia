import { Router, IRouter } from 'express';

const GAMES = [
  { id: 'MONSTER_HUNTER_WORLD', name: 'Monster Hunter: World', year: 2018, color: 'amber' },
  { id: 'MONSTER_HUNTER_WORLD_ICEBORNE', name: 'Monster Hunter World: Iceborne', year: 2019, color: 'blue' },
  { id: 'MONSTER_HUNTER_RISE', name: 'Monster Hunter Rise', year: 2021, color: 'red' },
  { id: 'MONSTER_HUNTER_RISE_SUNBREAK', name: 'Monster Hunter Rise: Sunbreak', year: 2022, color: 'purple' },
  { id: 'MONSTER_HUNTER_WILDS', name: 'Monster Hunter Wilds', year: 2025, color: 'teal' },
];

const router: IRouter = Router();

/**
 * @openapi
 * /api/games:
 *   get:
 *     summary: List all tracked games
 *     responses:
 *       200:
 *         description: Array of game metadata
 */
router.get('/', (_req, res) => {
  res.json({ data: GAMES });
});

export default router;
