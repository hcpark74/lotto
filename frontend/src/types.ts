export type DrawResult = {
    drwNo: number;
    drwNoDate: string;
    drwtNo1: number; drwtNo2: number; drwtNo3: number;
    drwtNo4: number; drwtNo5: number; drwtNo6: number;
    bnusNo: number;
    firstWinamnt: number;
};

export type PensionDrawResult = {
    draw_no: number;
    draw_date: string;
    winning_band: string;
    winning_number: string;
    bonus_number: string;
    synced_at: string;
    prize_counts?: {
        rank_no: number;
        internet_count: number;
        store_count: number;
        total_count: number;
        win_amount: number | null;
        total_amount: number | null;
    }[];
};

export type PensionRecommendationSet = {
    label: string;
    number: string;
    meta: {
        ruleId?: string;
        ruleWeight?: number;
        sum: number;
        oddCount: number;
        uniqueDigitCount: number;
        maxDuplicateCount: number;
        hasThreeConsecutive: boolean;
    };
};
export type PensionRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};
export type PensionRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageExactMatches: number;
    exactMatch3PlusRate: number;
    exactMatch4PlusRate: number;
};
export type PensionBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    setsPerDraw: number;
    totalGeneratedSets: number;
    averageExactMatchPerSet: number;
    averageBestExactMatchPerDraw: number;
    ruleDiagnostics: {
        currentWeights: PensionRuleWeight[];
        performance: PensionRulePerformance[];
    };
};

export type LottoSet = {
    numbers: number[];
    label: string;
    meta?: {
        ruleId?: string;
        ruleWeight?: number;
    };
};
export type LottoRuleWeight = {
    ruleId: string;
    label: string;
    weight: number;
    score: number;
    passRate: number;
    recentMatchRate: number;
};
export type LottoRulePerformance = {
    ruleId: string;
    label: string;
    generatedCount: number;
    averageMatches: number;
    zScore: number;
    ci95: [number, number];
    commonRulePassRate: number;
    relaxedFallbackRate: number;
    randomFallbackRate: number;
};
export type LottoBacktestBaseline = {
    theoretical: {
        expectedMatchPerSet: number;
        matchStdPerSet: number;
    };
    randomControl: {
        totalSets: number;
        averageMatchPerSet: number;
        zScore: number;
        ci95: [number, number];
    };
    overall: {
        zScore: number;
        ci95: [number, number];
        significant: boolean;
    };
};
export type LottoBacktestDiagnostics = {
    algorithm: string;
    evaluatedDraws: number;
    averageMatchPerSet: number;
    averageBestMatchPerDraw: number;
    baseline: LottoBacktestBaseline;
    generationQuality: {
        commonRulePassRate: number;
        relaxedFallbackRate: number;
        randomFallbackRate: number;
    };
    ruleDiagnostics: {
        currentWeights: LottoRuleWeight[];
        performance: LottoRulePerformance[];
    };
};
export type SyncResponse = {
    success: boolean;
    syncedCount: number;
    nextDrwNo: number;
    latestDraw: number;
};
