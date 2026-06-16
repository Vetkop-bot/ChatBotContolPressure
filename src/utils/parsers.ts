export function parseNumbers(text: string): { systolic: number; diastolic: number; pulse: number } | null {
    const numbers = text.match(/\d{2,3}/g);
    if (!numbers || numbers.length < 3) return null;
    const [s, d, p] = numbers.slice(0, 3).map(Number);
    if (s > d && s - d >= 20 && p >= 30 && p <= 200) {
        return { systolic: s, diastolic: d, pulse: p };
    }
    return null;
}