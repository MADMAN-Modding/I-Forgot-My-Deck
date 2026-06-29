export function totalCommanderDamage(commanderDamage?: number[]): number {
    if (!commanderDamage || commanderDamage.length === 0) return 0;
    return commanderDamage.reduce((sum, raw) => {
        const amount = Number.isFinite(raw) ? raw : 0;
        return sum + Math.max(0, amount);
    }, 0);
}

export function effectiveLifeTotal(life: number, commanderDamage?: number[]): number {
    return life - totalCommanderDamage(commanderDamage);
}

export function commanderDamageEntries(
    commanderDamage?: number[],
    labels?: string[],
): Array<{ label: string; amount: number }> {
    if (!commanderDamage || commanderDamage.length === 0) return [];
    return commanderDamage.map((raw, i) => ({
        label: labels?.[i] ?? `P${i + 1}`,
        amount: Math.max(0, Number.isFinite(raw) ? raw : 0),
    }));
}