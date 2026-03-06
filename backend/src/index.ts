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

// 1. 메인 페이지 HTML에서 최신 회차 번호를 추출하는 함수
async function getLatestDrawNo(): Promise<number | null> {
  try {
    const response = await fetch("https://www.dhlottery.co.kr/common.do?method=main", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });

    if (!response.ok) {
      console.error(`Main page fetch failed: ${response.status}`);
      return null;
    }
    const html = await response.text();
    // 더 유연한 정규식 (공백, 따옴표 등 대응)
    const match = html.match(/id=['"]lottoDrwNo['"]>\s*(\d+)\s*<\/strong>/);
    return match ? parseInt(match[1]) : null;
  } catch (e) {
    return null;
  }
}

// 2. 특정 회차의 결과를 가져오는 함수 (공식 API)
async function fetchLottoResult(drwNo: number) {
  try {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://www.dhlottery.co.kr/common.do?method=main',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const data: any = await response.json();
    if (!data || data.returnValue !== 'success') return null;
    return data;
  } catch (e: any) {
    return null;
  }
}

// Sync latest data
app.post('/api/sync', async (c) => {
  try {
    const latestDraw = await getLatestDrawNo();
    if (!latestDraw) return c.json({ success: false, error: "Could not fetch latest draw number" });

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
  // AI-weighted logic: mix of top frequent numbers and random
  const hotNumbers: any = await c.env.DB.prepare(`
    SELECT num FROM (
      SELECT drwtNo1 as num FROM lotto_history
      UNION ALL SELECT drwtNo2 FROM lotto_history
      UNION ALL SELECT drwtNo3 FROM lotto_history
      UNION ALL SELECT drwtNo4 FROM lotto_history
      UNION ALL SELECT drwtNo5 FROM lotto_history
      UNION ALL SELECT drwtNo6 FROM lotto_history
    ) GROUP BY num ORDER BY COUNT(*) DESC LIMIT 15
  `).all();

  const hotSet = hotNumbers.results.map((r: any) => r.num);
  const pool = [...hotSet, ...Array.from({ length: 45 }, (_, i) => i + 1)]; // Weight hot numbers higher

  const generated = new Set<number>();
  while (generated.size < 6) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    generated.add(pick);
  }

  const result = Array.from(generated).sort((a, b) => a - b);
  return c.json({ numbers: result, algorithm: "v1.0 (Frequency Weighted)" });
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log("Cron execution started");

    const latestDraw = await getLatestDrawNo();
    if (!latestDraw) {
      console.error("Cron: Could not fetch latest draw number");
      return;
    }

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
