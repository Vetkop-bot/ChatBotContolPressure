import { Context } from 'telegraf';
import { parseNumbers } from '../utils/parsers';
import { saveMeasurement } from '../services/measurementService';

export async function messageHandler(ctx: Context) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text;
    const telegramId = ctx.from?.id;

    if (!telegramId) {
        await ctx.reply('Не удалось определить пользователя.');
        return;
    }

    const parsed = parseNumbers(text);
    if (!parsed) {
        await ctx.reply(' Отправь три числа: систола диастола пульс, например: 120 80 75');
        return;
    }

    const { systolic, diastolic, pulse } = parsed;

    try {
        await saveMeasurement(telegramId, systolic, diastolic, pulse);
        await ctx.reply(
            ` Сохранено: ${systolic}/${diastolic}, пульс ${pulse}`
        );
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        await ctx.reply(' Не удалось сохранить данные. Попробуйте позже.');
    }
}