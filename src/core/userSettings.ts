import { prisma } from '../services/database/db';

type Platform = 'telegram' | 'max';

export async function getUserSettings(platform: Platform, userId: string | number | bigint) {
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
    platform: Platform,
    userId: string | number | bigint,
    data: {
        medication?: string;
        targetSystolic?: number;
        targetDiastolic?: number;
        notificationsEnabled?: boolean;
        notifyOnHigh?: boolean;
    }
) {
    let where;
    if (platform === 'telegram') {
        where = { telegramId: userId as number | bigint };
    } else {
        where = { maxUserId: userId as string };
    }

    let user = await prisma.user.findUnique({ where });
    if (!user) {
        const createData = platform === 'telegram'
            ? { telegramId: userId as number | bigint }
            : { maxUserId: userId as string };
        user = await prisma.user.create({ data: createData });
    }

    return await prisma.user.update({
        where: { id: user.id },
        data,
    });
}