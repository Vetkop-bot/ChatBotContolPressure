export function parseThreeNumbers(text: string): { systolic: number; diastolic: number; pulse: number } | null {
    const cleaned = text.replace(/[,;:\/]/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length < 3) return null;
    const nums = parts.slice(0, 3).map(Number);
    if (nums.some(isNaN)) return null;
    const [systolic, diastolic, pulse] = nums;
    if (systolic <= 0 || diastolic <= 0 || pulse <= 0 || systolic > 300 || diastolic > 200 || pulse > 250) return null;
    return { systolic, diastolic, pulse };
}