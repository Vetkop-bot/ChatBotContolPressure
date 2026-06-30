export function parseNumbers(text: string): { systolic: number; diastolic: number; pulse: number } | null {
    const cleaned = text.replace(/[,;:\/]/g, ' ');
    let parts = cleaned.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 3) {
        const nums = parts.slice(0, 3).map(Number);
        if (nums.every(n => !isNaN(n)) && isValidBP(nums[0], nums[1], nums[2])) {
            return { systolic: nums[0], diastolic: nums[1], pulse: nums[2] };
        }
    }

    const digits = text.replace(/\D/g, '');
    if (digits.length < 3) return null;

    for (let len1 = 1; len1 <= 4; len1++) {
        for (let len2 = 1; len2 <= 4; len2++) {
            const len3 = digits.length - len1 - len2;
            if (len3 < 1 || len3 > 4) continue;
            const s = parseInt(digits.substring(0, len1), 10);
            const d = parseInt(digits.substring(len1, len1 + len2), 10);
            const p = parseInt(digits.substring(len1 + len2), 10);
            if (isValidBP(s, d, p)) {
                return { systolic: s, diastolic: d, pulse: p };
            }
        }
    }

    return null;
}

function isValidBP(s: number, d: number, p: number): boolean {
    return s >= 70 && s <= 250 &&
        d >= 40 && d <= 160 &&
        p >= 30 && p <= 200 &&
        s > d && (s - d) >= 20;
}