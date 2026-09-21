// One-time seed: admin user + model policies. Run: node seed.mjs (from packages/prisma)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const MODES = [
    'gemini-2.5-flash-lite',
    'claude-sonnet-4-6',
    'claude-opus-4-6-thinking',
    'gpt-oss-120b-medium',
];

async function main() {
    const proOnly = new Set(['claude-sonnet-4-6', 'claude-opus-4-6-thinking']);
    await prisma.modelPolicy.deleteMany({ where: { mode: { notIn: MODES } } });
    for (const mode of MODES) {
        await prisma.modelPolicy.upsert({
            where: { mode },
            update: {
                freeAllowed: !proOnly.has(mode),
                proAllowed: true,
            },
            create: { mode, freeAllowed: !proOnly.has(mode), proAllowed: true },
        });
    }
    console.log(`model policies ok (${MODES.length})`);

    const email = (process.env.ADMIN_SEED_EMAIL || 'admin@kiln.local').toLowerCase();
    const password = process.env.ADMIN_SEED_PASSWORD || 'admin123';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
        await prisma.user.create({
            data: {
                email,
                passwordHash: await bcrypt.hash(password, 12),
                isAdmin: true,
                isPro: true,
                lastResetDate: new Date().toISOString().split('T')[0],
            },
        });
        console.log(`admin created: ${email}`);
    } else {
        console.log(`admin exists: ${email}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
