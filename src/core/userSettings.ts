import { prisma } from '../services/database/db';

export async function getUserSettings(platform: 'telegram' | 'max', userId: string | number | bigint) {
    const where = platform === 'telegram'
        ? { telegramId: userId as number | bigint }
        : { maxUserId: userId as string };
    return await prisma.user.findUnique({
        where,
        select: {
            medication: true,
            targetSystolic: true,
            targetDiastolic: true,
            notificationsEnabled: true,
            notifyOnHigh: true,
        }
    });
}

export async function updateUserSettings(
    platform: 'telegram' | 'max',
    userId: string | number | bigint,
    data: {
        medication?: string;
        targetSystolic?: number;
        targetDiastolic?: number;
        notificationsEnabled?: boolean;
        notifyOnHigh?: boolean;
    }
) {
    const where = platform === 'telegram'
        ? { telegramId: userId as number | bigint }
        : { maxUserId: userId as string };
    let user = await prisma.user.findUnique({ where });
    if (!user) {
        user = await prisma.user.create({
            data: platform === 'telegram'
                ? { telegramId: userId as number | bigint }
                : { maxUserId: userId as string }
        });
    }
    return await prisma.user.update({ where: { id: user.id }, data });
}