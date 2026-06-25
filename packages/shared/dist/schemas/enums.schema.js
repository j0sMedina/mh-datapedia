"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditActionSchema = exports.RoleSchema = exports.DropMethodSchema = exports.RankSchema = exports.DifficultySchema = exports.WeaknessRatingSchema = exports.ElementSchema = exports.MonsterTypeSchema = exports.MHGameSchema = void 0;
const zod_1 = require("zod");
exports.MHGameSchema = zod_1.z.enum([
    'MONSTER_HUNTER_WORLD',
    'MONSTER_HUNTER_WORLD_ICEBORNE',
    'MONSTER_HUNTER_RISE',
    'MONSTER_HUNTER_RISE_SUNBREAK',
    'MONSTER_HUNTER_WILDS',
]);
exports.MonsterTypeSchema = zod_1.z.enum([
    'Large',
    'Small',
    'ElderDragon',
    'Apex',
    'Afflicted',
    'Tempered',
    'FlyingWyvern',
    'BruteWyvern',
    'FangedBeast',
    'Temnoceran',
    'BirdWyvern',
    'Construct',
    'DemiElderDragon',
    'Leviathan',
    'Amphibian',
    'Cephalopod',
    'Machine',
]);
exports.ElementSchema = zod_1.z.enum([
    'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
    'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
]);
exports.WeaknessRatingSchema = zod_1.z.union([
    zod_1.z.literal(0), zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3),
]);
exports.DifficultySchema = zod_1.z.enum(['Beginner', 'Intermediate', 'Advanced']);
exports.RankSchema = zod_1.z.enum(['LowRank', 'HighRank', 'MasterRank']);
exports.DropMethodSchema = zod_1.z.enum([
    'BodyCarve',
    'TailCarve',
    'BreakReward',
    'CaptureReward',
    'QuestReward',
    'ShinyDrop',
    'WoundDrop',
    'PalicoBoomerang',
]);
exports.RoleSchema = zod_1.z.enum(['USER', 'HELPER', 'ADMIN', 'MASTER']);
exports.AuditActionSchema = zod_1.z.enum(['ROLE_CHANGE', 'BAN', 'UNBAN']);
//# sourceMappingURL=enums.schema.js.map