import { getSessionUser } from '@/lib/auth';
import { prisma } from '@repo/prisma';
import { geolocation } from '@vercel/functions';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const session = await getSessionUser();
    const userId =
        session?.id ||
        `visitor:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}`;

    const { feedback } = await request.json();

    await prisma.feedback.create({
        data: {
            userId,
            feedback,
            metadata: JSON.stringify({
                geo: geolocation(request),
            }),
        },
    });

    return NextResponse.json({ message: 'Feedback received' }, { status: 200 });
}
