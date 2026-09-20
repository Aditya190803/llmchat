import { prisma } from '@repo/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';

// Only HTML pages can be published. Slide decks are download-only (.pptx).
const publishSchema = z.object({
    title: z.string().trim().min(1).max(120),
    content: z.string().min(1).max(500_000),
    /** Existing share id: republishing updates the same link. */
    shareId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Sign in to publish pages' }, { status: 401 });
    }

    const parsed = publishSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }
    const { title, content, shareId } = parsed.data;

    try {
        const existing = shareId
            ? await prisma.sharedPage.findUnique({ where: { id: shareId } })
            : null;
        const row =
            existing && existing.ownerId === user.id
                ? await prisma.sharedPage.update({
                      where: { id: existing.id },
                      data: { title, content, version: { increment: 1 } },
                  })
                : await prisma.sharedPage.create({ data: { ownerId: user.id, title, content } });
        return NextResponse.json({ id: row.id, version: row.version });
    } catch (e) {
        console.error('Publish page failed', e);
        return NextResponse.json({ error: 'Could not publish right now' }, { status: 500 });
    }
}
