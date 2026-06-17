import { prisma } from '../services/database/db';

export async function handleCommand(
    platform: 'telegram' | 'max',
    userId: string | number | bigint,
    command: string
): Promise<string | null> {
    if (command === '/start') {
        return 'Привет! Отправь три числа (систола диастола пульс) или фото тонометра.\nПример: 120 80 75';
    }

    if (command === '/help') {
        return 'Инструкция:\n' +
            '1. Отправь три числа через пробел, запятую или слеш.\n' +
            '2. Отправь фото тонометра — я попробую распознать показания.\n' +
            '3. Команды: /start, /help, /stats';
    }

    if (command === '/stats') {
        // Используем отдельные запросы для каждой платформы
        let user = null;
        if (platform === 'telegram') {
            user = await prisma.user.findUnique({
                where: { telegramId: userId as number | bigint },
                include: {
                    measurements: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                }
            });
        } else {
            user = await prisma.user.findUnique({
                where: { maxUserId: userId as string },
                include: {
                    measurements: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                }
            });
        }

        if (!user || user.measurements.length === 0) {
            return 'Нет сохранённых измерений.';
        }

        let reply = ' Последние 5 замеров:\n';
        user.measurements.forEach((m, i) => {
            reply += `${i+1}. ${m.systolic}/${m.diastolic} (пульс ${m.pulse}) — ${new Date(m.createdAt).toLocaleString()}\n`;
        });
        return reply;
    }

    return null;
}