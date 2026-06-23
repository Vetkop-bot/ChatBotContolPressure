import { prisma } from '../services/database/db';
import {getUserSettings, updateUserSettings} from "./userSettings";

export async function handleCommand(
    platform: 'telegram' | 'max',
    userId: string | number | bigint,
    command: string
): Promise<string | null> {
    if (command === '/start') {
        return 'Привет! Отправь три числа (систола диастола пульс) или фото тонометра.\nПример: 120 80 75';
    }

    if (command === '/help') {
        return 'Привет! Я бот для контроля давления.\n\n' +
            ' Отправь три числа (систола диастола пульс) через пробел, запятую или слеш.\n' +
            '   Пример: `120 80 75`\n\n' +
            '  Отправь фото тонометра — я распознаю показания.\n\n' +
            'Я рассчитаю:\n' +
            '• Пульсовое давление (ПД)\n' +
            '• Тройное произведение (ТП)\n' +
            '• Среднее артериальное давление (СрАД)\n' +
            '• Индекс Кердо\n\n' +
            'Если давление выше нормы и нет тенденции к снижению — я напомню о препарате.\n\n' +
            '  Команды:\n' +
            '`/stats` – последние 5 замеров с индексами\n' +
            '`/settings` – ваши настройки\n' +
            '`/set_medication <название>` – сохранить препарат\n' +
            '`/set_norm <систола> <диастола>` – установить личную норму\n' +
            '`/set_notifications on|off` – включить/отключить уведомления о превышении';
    }

    if (command === '/stats') {
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
    if (command === '/settings') {
        const settings = await getUserSettings(platform, userId);
        if (!settings) return 'Настройки не найдены.';
        let reply = 'Ваши настройки:\n';
        reply += `Препарат: ${settings.medication || 'не задан'}\n`;
        reply += `Целевое давление: ${settings.targetSystolic || 'авто'} / ${settings.targetDiastolic || 'авто'}\n`;
        reply += `Уведомления: ${settings.notificationsEnabled ? 'включены' : 'отключены'}\n`;
        reply += `Оповещать о превышении: ${settings.notifyOnHigh ? 'да' : 'нет'}\n`;
        return reply;
    }

    if (command.startsWith('/set_medication')) {
        const medication = command.replace('/set_medication', '').trim();
        if (!medication) return 'Укажите название препарата, например: /set_medication Каптоприл 25 мг';
        await updateUserSettings(platform, userId, { medication });
        return `Препарат "${medication}" сохранён. Я буду использовать его в напоминаниях.`;
    }

    if (command.startsWith('/set_norm')) {
        const parts = command.split(' ');
        if (parts.length < 3) return 'Укажите систолу и диастолу, например: /set_norm 130 80';
        const sys = parseInt(parts[1], 10);
        const dia = parseInt(parts[2], 10);
        if (isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) return 'Некорректные значения.';
        await updateUserSettings(platform, userId, { targetSystolic: sys, targetDiastolic: dia });
        return `Целевое давление установлено: ${sys}/${dia}. Теперь я буду сравнивать с этой нормой.`;
    }

    if (command.startsWith('/set_notifications')) {
        const value = command.split(' ')[1];
        if (value !== 'on' && value !== 'off') return 'Используйте: /set_notifications on или off';
        await updateUserSettings(platform, userId, { notificationsEnabled: value === 'on' });
        return `Уведомления ${value === 'on' ? 'включены' : 'отключены'}.`;
    }

    return null;
}