/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => {
  return c.text('Lotto Analysis API')
})

// 날짜 계산으로 최신 회차 추정 (1회: 2002-12-07 KST)
function getLatestDrawNo(): number {
  const FIRST_DRAW = new Date('2002-12-07T12:00:00Z'); // 2002-12-07 21:00 KST
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((Date.now() - FIRST_DRAW.getTime()) / MS_PER_WEEK) + 1);
}

// 공식 JSON API로 특정 회차 결과 조회
async function fetchLottoResult(drwNo: number) {
  try {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.dhlottery.co.kr/',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    if (data.returnValue !== 'success') return null;
    return {
      drwNo: data.drwNo,
      drwNoDate: data.drwNoDate,
      drwtNo1: data.drwtNo1,
      drwtNo2: data.drwtNo2,
      drwtNo3: data.drwtNo3,
      drwtNo4: data.drwtNo4,
      drwtNo5: data.drwtNo5,
      drwtNo6: data.drwtNo6,
      bnusNo: data.bnusNo,
      firstWinamnt: data.firstWinamnt,
    };
  } catch (e) {
    return null;
  }
}

// Sync latest data
app.post('/api/sync', async (c) => {
  try {
    const latestDraw = getLatestDrawNo();

    const lastEntry: any = await c.env.DB.prepare('SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT 1').first();
    let currentDrwNo = (lastEntry?.drwNo || 0) + 1;
    let syncedCount = 0;
    const maxSyncPerRequest = 10;
    let lastResult = null;

    while (currentDrwNo <= latestDraw && syncedCount < maxSyncPerRequest) {
      const result = await fetchLottoResult(currentDrwNo);
      lastResult = result;

      if (!result) {
        break;
      }

      await c.env.DB.prepare(
        `INSERT INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        result.drwNo, result.drwNoDate, result.drwtNo1, result.drwtNo2, result.drwtNo3,
        result.drwtNo4, result.drwtNo5, result.drwtNo6, result.bnusNo, result.firstWinamnt
      ).run();

      currentDrwNo++;
      syncedCount++;
    }

    return c.json({
      success: true,
      syncedCount,
      nextDrwNo: currentDrwNo,
      debug: lastResult
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
})

// Get draw results
app.get('/api/results', async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit') ?? 10), 50);
    const drwNo = c.req.query('drwNo');

    if (drwNo) {
      const row = await c.env.DB.prepare(
        'SELECT * FROM lotto_history WHERE drwNo = ?'
      ).bind(Number(drwNo)).first();
      if (!row) return c.json({ error: '해당 회차 데이터가 없습니다.' }, 404);
      return c.json(row);
    }

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM lotto_history ORDER BY drwNo DESC LIMIT ?'
    ).bind(limit).all();
    return c.json(results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
})

// Get latest stats
app.get('/api/stats/hot', async (c) => {
  // Simple frequency analysis for all numbers
  const query = `
    SELECT num, COUNT(*) as count FROM (
      SELECT drwtNo1 as num FROM lotto_history
      UNION ALL SELECT drwtNo2 FROM lotto_history
      UNION ALL SELECT drwtNo3 FROM lotto_history
      UNION ALL SELECT drwtNo4 FROM lotto_history
      UNION ALL SELECT drwtNo5 FROM lotto_history
      UNION ALL SELECT drwtNo6 FROM lotto_history
    ) GROUP BY num ORDER BY count DESC LIMIT 10
  `;
  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
})

// Generate numbers
app.post('/api/generate', async (c) => {
  try {
    const totalRow: any = await c.env.DB.prepare('SELECT COUNT(*) as n FROM lotto_history').first();
    const total: number = totalRow?.n ?? 0;

    // 데이터 없으면 순수 랜덤
    if (total === 0) {
      const set = new Set<number>();
      while (set.size < 6) set.add(Math.floor(Math.random() * 45) + 1);
      return c.json({ numbers: Array.from(set).sort((a, b) => a - b), algorithm: 'v2.0 (랜덤 - 데이터 없음)' });
    }

    const NUMBERS_SQL = `
      SELECT drwtNo1 as num FROM lotto_history h JOIN t ON h.drwNo = t.drwNo UNION ALL
      SELECT drwtNo2 FROM lotto_history h JOIN t ON h.drwNo = t.drwNo UNION ALL
      SELECT drwtNo3 FROM lotto_history h JOIN t ON h.drwNo = t.drwNo UNION ALL
      SELECT drwtNo4 FROM lotto_history h JOIN t ON h.drwNo = t.drwNo UNION ALL
      SELECT drwtNo5 FROM lotto_history h JOIN t ON h.drwNo = t.drwNo UNION ALL
      SELECT drwtNo6 FROM lotto_history h JOIN t ON h.drwNo = t.drwNo
    `;

    // 전체 빈도
    const { results: freqRows } = await c.env.DB.prepare(`
      WITH t AS (SELECT drwNo FROM lotto_history)
      SELECT num, COUNT(*) as cnt FROM (${NUMBERS_SQL}) GROUP BY num
    `).all() as { results: { num: number; cnt: number }[] };

    // 최근 30회 빈도
    const recentN = Math.min(30, total);
    const { results: recentRows } = await c.env.DB.prepare(`
      WITH t AS (SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT ${recentN})
      SELECT num, COUNT(*) as cnt FROM (${NUMBERS_SQL}) GROUP BY num
    `).all() as { results: { num: number; cnt: number }[] };

    // 최근 15회 출현 번호 (콜드 판별용)
    const coldN = Math.min(15, total);
    const { results: coldRows } = await c.env.DB.prepare(`
      WITH t AS (SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT ${coldN})
      SELECT DISTINCT num FROM (${NUMBERS_SQL})
    `).all() as { results: { num: number }[] };

    const freqMap = new Map(freqRows.map(r => [r.num, r.cnt]));
    const recentMap = new Map(recentRows.map(r => [r.num, r.cnt]));
    const recentSet = new Set(coldRows.map(r => r.num));

    const maxFreq = Math.max(...freqMap.values(), 1);
    const maxRecent = Math.max(...recentMap.values(), 1);

    // 가중치 계산: 전체빈도 40% + 최근30회 60%, 콜드번호 50% 페널티
    const weights = Array.from({ length: 45 }, (_, i) => {
      const num = i + 1;
      const freqScore = (freqMap.get(num) ?? 0) / maxFreq;
      const recentScore = (recentMap.get(num) ?? 0) / maxRecent;
      const isCold = !recentSet.has(num);
      let w = freqScore * 0.4 + recentScore * 0.6;
      if (isCold) w *= 0.5;
      return { num, weight: Math.max(w, 0.02) }; // 최소 가중치 보장
    });

    // 누적 가중치 기반 랜덤 선택
    function weightedPick(pool: { num: number; weight: number }[]): number {
      const total = pool.reduce((s, x) => s + x.weight, 0);
      let r = Math.random() * total;
      for (const x of pool) {
        r -= x.weight;
        if (r <= 0) return x.num;
      }
      return pool[pool.length - 1].num;
    }

    // v3.0: 홀짝균형 + 연속방지 + 합계범위 + 구간분포 + 끝수중복방지
    let result: number[] = [];
    for (let attempt = 0; attempt < 50; attempt++) {
      const picked = new Set<number>();
      const pool = [...weights];
      while (picked.size < 6) {
        const avail = pool.filter(x => !picked.has(x.num));
        picked.add(weightedPick(avail));
      }
      const sorted = Array.from(picked).sort((a, b) => a - b);

      // 1. 홀짝 비율 (홀수 2~4개)
      const oddCount = sorted.filter(n => n % 2 === 1).length;
      if (oddCount < 2 || oddCount > 4) continue;

      // 2. 연속 번호 3개 이상 방지
      let maxConsec = 1, cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        cur = sorted[i] === sorted[i - 1] + 1 ? cur + 1 : 1;
        if (cur > maxConsec) maxConsec = cur;
      }
      if (maxConsec >= 3) continue;

      // 3. 합계 범위 (당첨번호 합계 분포: 100~175)
      const sum = sorted.reduce((a, b) => a + b, 0);
      if (sum < 100 || sum > 175) continue;

      // 4. 번호 구간 분포 (5구간 중 최소 3구간 이상)
      const zones = new Set(sorted.map(n => Math.ceil(n / 10)));
      if (zones.size < 3) continue;

      // 5. 끝수(1의 자리) 중복 최대 2개
      const tailCounts = new Map<number, number>();
      for (const n of sorted) {
        const t = n % 10;
        tailCounts.set(t, (tailCounts.get(t) ?? 0) + 1);
      }
      if (Math.max(...tailCounts.values()) > 2) continue;

      result = sorted;
      break;
    }

    // 50회 시도 후 미충족 시 마지막 결과 사용
    if (result.length === 0) {
      const picked = new Set<number>();
      while (picked.size < 6) {
        const avail = weights.filter(x => !picked.has(x.num));
        picked.add(weightedPick(avail));
      }
      result = Array.from(picked).sort((a, b) => a - b);
    }

    return c.json({ numbers: result, algorithm: 'v3.0 (빈도+추세+홀짝+합계범위+구간분포+끝수균형)' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log("Cron execution started");

    const latestDraw = getLatestDrawNo();

    const lastEntry: any = await env.DB.prepare('SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT 1').first();
    let currentDrwNo = (lastEntry?.drwNo || 0) + 1;
    let syncedCount = 0;

    while (currentDrwNo <= latestDraw) {
      const result = await fetchLottoResult(currentDrwNo);
      if (!result) break;

      await env.DB.prepare(
        `INSERT INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        result.drwNo, result.drwNoDate, result.drwtNo1, result.drwtNo2, result.drwtNo3,
        result.drwtNo4, result.drwtNo5, result.drwtNo6, result.bnusNo, result.firstWinamnt
      ).run();

      currentDrwNo++;
      syncedCount++;
    }

    console.log(`Cron: synced ${syncedCount} draw(s), latest drwNo=${latestDraw}`);
  }
}
