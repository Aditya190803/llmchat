/*
 * Write the product's model tiering into ModelPolicy rows, so the admin UI and
 * the API agree. Safe to re-run. Usage, from packages/prisma:
 *
 *   node sync-model-policies.mjs          # show what would change
 *   node sync-model-policies.mjs --apply  # write it
 *
 * Needs DATABASE_URL, AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY.
 */
import { PrismaClient } from '@prisma/client';
import {
    FREE_MODEL_IDS,
    isSelectableModel,
} from '../shared/config/model-tiers.ts';

const apply = process.argv.includes('--apply');
const BASE = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';
const key = process.env.AI_GATEWAY_API_KEY;

if (!key) {
    console.error('AI_GATEWAY_API_KEY is required');
    process.exit(1);
}

const prisma = new PrismaClient();

const response = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
if (!response.ok) {
    console.error(`Gateway responded ${response.status}`);
    process.exit(1);
}
const models = ((await response.json()).data || []).map(model => model.id).filter(Boolean).sort();

const existing = new Map((await prisma.modelPolicy.findMany()).map(row => [row.mode, row]));
const changes = [];

for (const mode of models) {
    const selectable = isSelectableModel(mode);
    const wanted = {
        freeAllowed: selectable && FREE_MODEL_IDS.includes(mode),
        proAllowed: selectable,
    };
    const current = existing.get(mode);
    if (
        current &&
        current.freeAllowed === wanted.freeAllowed &&
        current.proAllowed === wanted.proAllowed
    ) {
        continue;
    }
    changes.push({ mode, from: current, to: wanted });
}

const label = policy => (!policy ? 'none' : `free=${policy.freeAllowed} pro=${policy.proAllowed}`);
for (const change of changes) {
    console.log(`${change.mode.padEnd(38)} ${label(change.from)}  ->  ${label(change.to)}`);
}

const free = models.filter(m => isSelectableModel(m) && FREE_MODEL_IDS.includes(m));
const pro = models.filter(m => isSelectableModel(m));
console.log(
    `\n${models.length} gateway models: ${free.length} free, ${pro.length} pro, ${models.length - pro.length} hidden`
);

if (!apply) {
    console.log(changes.length ? '\nRe-run with --apply to write these.' : '\nAlready in sync.');
} else {
    for (const change of changes) {
        await prisma.modelPolicy.upsert({
            where: { mode: change.mode },
            create: { mode: change.mode, ...change.to },
            update: change.to,
        });
    }
    console.log(`\nApplied ${changes.length} change(s).`);
}

await prisma.$disconnect();
