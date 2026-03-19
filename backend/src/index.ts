/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

type DrawNumbersRow = {
  drwNo?: number;
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
  bnusNo?: number;
}

type GeneratedSet = {
  label: string;
  numbers: number[];
  meta?: {
    sum: number;
    oddCount: number;
    maxConsecutiveRun: number;
    passedRules: string[];
  };
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => {
  return c.text('Lotto Analysis API')
})

const LOTTO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.dhlottery.co.kr/lt645/result',
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

const PENSION_HEADERS = {
  'User-Agent': LOTTO_HEADERS['User-Agent'],
  'Referer': 'https://www.dhlottery.co.kr/pt720/result',
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

type LottoHistoryItem = {
  ltEpsd: number;
  ltRflYmd: string;
  tm1WnNo: number;
  tm2WnNo: number;
  tm3WnNo: number;
  tm4WnNo: number;
  tm5WnNo: number;
  tm6WnNo: number;
  bnsWnNo: number;
  rnk1WnAmt: number;
}

type Pension720DrawRecord = {
  draw_no: number;
  draw_date: string;
  winning_band: string;
  winning_number: string;
  bonus_number: string;
  synced_at: string;
  raw_payload?: string;
}

type Pension720SyncSummary = {
  syncedCount: number;
  latestDraw: number;
  nextDrawNo: number;
}

type Pension720PrizeCountRecord = {
  draw_no: number;
  rank_no: number;
  internet_count: number;
  store_count: number;
  total_count: number;
  win_amount: number | null;
  total_amount: number | null;
  raw_payload?: string;
}

type Pension720ListItem = {
  psltEpsd?: number | string;
  psltRflYmd?: string;
  wnBndNo?: number | string;
  wnRnkVl?: number | string;
  bnsRnkVl?: number | string;
  [key: string]: unknown;
}

type Pension720PrizeInfoItem = {
  ltEpsd?: number | string;
  wnRnk?: number | string;
  wnInternetCnt?: number | string;
  wnStoreCnt?: number | string;
  wnTotalCnt?: number | string;
  wnAmt?: number | string;
  totAmt?: number | string;
  [key: string]: unknown;
}

type PensionRecommendationSet = {
  label: string;
  number: string;
  meta: {
    sum: number;
    oddCount: number;
    uniqueDigitCount: number;
    maxDuplicateCount: number;
    hasThreeConsecutive: boolean;
  };
}

async function getLatestDrawNo() {
  const response = await fetch('https://www.dhlottery.co.kr/lt645/result', {
    headers: LOTTO_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`최신 회차 조회 실패 (${response.status})`)
  }

  const html = await response.text()
  const match = html.match(/id="opt_val"\s+value="(\d+)"/)

  if (!match) {
    throw new Error('최신 회차 번호를 찾을 수 없습니다.')
  }

  return Number(match[1])
}

async function fetchLottoResult(drwNo: number) {
  try {
    const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${drwNo}&srchCursorLtEpsd=${drwNo}`
    const response = await fetch(url, {
      headers: LOTTO_HEADERS,
    })

    if (!response.ok) return null

    const data = await response.json() as { data?: { list?: LottoHistoryItem[] } }
    const item = data?.data?.list?.find((row) => row.ltEpsd === drwNo)

    if (!item) return null

    const date = String(item.ltRflYmd)
    if (!/^\d{8}$/.test(date)) {
      console.warn(`Invalid date format for draw ${drwNo}: ${date}`)
      return null
    }

    return {
      drwNo: item.ltEpsd,
      drwNoDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      drwtNo1: item.tm1WnNo,
      drwtNo2: item.tm2WnNo,
      drwtNo3: item.tm3WnNo,
      drwtNo4: item.tm4WnNo,
      drwtNo5: item.tm5WnNo,
      drwtNo6: item.tm6WnNo,
      bnusNo: item.bnsWnNo,
      firstWinamnt: item.rnk1WnAmt,
    }
  } catch (e) {
    return null
  }
}

async function getLatestPensionDrawNo() {
  const draws = await fetchPensionDrawList()
  const latest = draws[0]
  const latestDrawNo = Number(latest?.psltEpsd)

  if (!Number.isFinite(latestDrawNo) || latestDrawNo <= 0) {
    throw new Error('연금복권 최신 회차 번호를 찾을 수 없습니다.')
  }

  return latestDrawNo
}

async function fetchPensionDrawList(): Promise<Pension720ListItem[]> {
  const response = await fetch('https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do', {
    headers: PENSION_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`연금복권 회차 목록 조회 실패 (${response.status})`)
  }

  const data = await response.json() as { data?: { result?: Pension720ListItem[] } }
  const results = data?.data?.result

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('연금복권 회차 목록 데이터가 비어 있습니다.')
  }

  return results
}

function mapPensionDraw(row: Pension720ListItem): Pension720DrawRecord | null {
  const drawNo = Number(row.psltEpsd)
  const date = String(row.psltRflYmd ?? '')
  const winningBand = String(row.wnBndNo ?? '').trim()
  const winningNumber = String(row.wnRnkVl ?? '').trim()
  const bonusNumber = String(row.bnsRnkVl ?? '').trim()

  if (!Number.isFinite(drawNo) || drawNo <= 0) return null
  if (!date || !winningBand || !winningNumber || !bonusNumber) return null

  const normalizedDate = date.length === 8
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : date

  return {
    draw_no: drawNo,
    draw_date: normalizedDate,
    winning_band: winningBand,
    winning_number: winningNumber,
    bonus_number: bonusNumber,
    synced_at: new Date().toISOString(),
    raw_payload: JSON.stringify(row),
  }
}

async function fetchPensionPrizeCounts(drawNo: number): Promise<Pension720PrizeInfoItem[]> {
  const response = await fetch(`https://www.dhlottery.co.kr/pt720/selectPstPt720WnInfo.do?srchPsltEpsd=${drawNo}`, {
    headers: PENSION_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`연금복권 당첨 통계 조회 실패 (${response.status})`)
  }

  const data = await response.json() as { data?: { result?: Pension720PrizeInfoItem[] } }
  const results = data?.data?.result

  if (!Array.isArray(results)) {
    throw new Error('연금복권 당첨 통계 데이터가 비어 있습니다.')
  }

  return results
}

function mapPensionPrizeCount(row: Pension720PrizeInfoItem): Pension720PrizeCountRecord | null {
  const drawNo = Number(row.ltEpsd)
  const rankNo = Number(row.wnRnk)

  if (!Number.isFinite(drawNo) || drawNo <= 0) return null
  if (!Number.isFinite(rankNo) || rankNo <= 0) return null

  return {
    draw_no: drawNo,
    rank_no: rankNo,
    internet_count: Number(row.wnInternetCnt ?? 0),
    store_count: Number(row.wnStoreCnt ?? 0),
    total_count: Number(row.wnTotalCnt ?? 0),
    win_amount: row.wnAmt == null ? null : Number(row.wnAmt),
    total_amount: row.totAmt == null ? null : Number(row.totAmt),
    raw_payload: JSON.stringify(row),
  }
}

function getDigitSum(digits: number[]) {
  return digits.reduce((sum, digit) => sum + digit, 0)
}

function getOddDigitCount(digits: number[]) {
  return digits.filter(digit => digit % 2 === 1).length
}

function getUniqueDigitCount(digits: number[]) {
  return new Set(digits).size
}

function hasThreeConsecutiveDigits(digits: number[]) {
  for (let i = 0; i <= digits.length - 3; i++) {
    const ascending = digits[i] + 1 === digits[i + 1] && digits[i + 1] + 1 === digits[i + 2]
    const descending = digits[i] - 1 === digits[i + 1] && digits[i + 1] - 1 === digits[i + 2]
    if (ascending || descending) {
      return true
    }
  }
  return false
}

function getMaxDuplicateCount(digits: number[]) {
  const counts = new Map<number, number>()
  for (const digit of digits) counts.set(digit, (counts.get(digit) ?? 0) + 1)
  return Math.max(...counts.values(), 1)
}

function buildPensionRecommendation(label: string) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
    const sum = getDigitSum(digits)
    const oddCount = getOddDigitCount(digits)
    const uniqueDigitCount = getUniqueDigitCount(digits)
    const threeConsecutive = hasThreeConsecutiveDigits(digits)
    const maxDuplicateCount = getMaxDuplicateCount(digits)

    if (sum < 22 || sum > 34) continue
    if (oddCount < 2 || oddCount > 4) continue
    if (uniqueDigitCount < 4) continue
    if (threeConsecutive) continue
    if (maxDuplicateCount >= 3) continue

    return {
      label,
      number: digits.join(''),
      meta: {
        sum,
        oddCount,
        uniqueDigitCount,
        maxDuplicateCount,
        hasThreeConsecutive: threeConsecutive,
      },
    }
  }

  const fallbackDigits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
  return {
    label,
    number: fallbackDigits.join(''),
    meta: {
      sum: getDigitSum(fallbackDigits),
      oddCount: getOddDigitCount(fallbackDigits),
      uniqueDigitCount: getUniqueDigitCount(fallbackDigits),
      maxDuplicateCount: getMaxDuplicateCount(fallbackDigits),
      hasThreeConsecutive: hasThreeConsecutiveDigits(fallbackDigits),
    },
  }
}

function buildPensionRecommendations() {
  return [buildPensionRecommendation('정교 추천 1세트')]
}

async function syncPensionResults(db: D1Database, limit = 0): Promise<Pension720SyncSummary> {
  const latestDraw = await getLatestPensionDrawNo()
  const list = await fetchPensionDrawList()

  const lastEntry = await db.prepare(
    'SELECT draw_no FROM pension720_draws ORDER BY draw_no DESC LIMIT 1'
  ).first<{ draw_no: number }>()

  const currentMaxDraw = lastEntry?.draw_no ?? 0
  const newDraws = list
    .map(mapPensionDraw)
    .filter((row): row is Pension720DrawRecord => row !== null)
    .filter(row => row.draw_no > currentMaxDraw)
    .sort((a, b) => a.draw_no - b.draw_no)

  const limitedDraws = limit > 0 ? newDraws.slice(0, limit) : newDraws

  for (const row of limitedDraws) {
    await db.prepare(
      `INSERT OR REPLACE INTO pension720_draws
      (draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.draw_no,
      row.draw_date,
      row.winning_band,
      row.winning_number,
      row.bonus_number,
      row.synced_at,
      row.raw_payload ?? null,
    ).run()

    const prizeCounts = await fetchPensionPrizeCounts(row.draw_no)
    for (const prizeRow of prizeCounts) {
      const mapped = mapPensionPrizeCount(prizeRow)
      if (!mapped) continue

      await db.prepare(
        `INSERT OR REPLACE INTO pension720_prize_counts
        (draw_no, rank_no, internet_count, store_count, total_count, win_amount, total_amount, raw_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        mapped.draw_no,
        mapped.rank_no,
        mapped.internet_count,
        mapped.store_count,
        mapped.total_count,
        mapped.win_amount,
        mapped.total_amount,
        mapped.raw_payload ?? null,
      ).run()
    }
  }

  return {
    syncedCount: limitedDraws.length,
    latestDraw,
    nextDrawNo: latestDraw + 1,
  }
}

const COLS = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const

const SET_CONFIGS: { label: string; check: (s: number[]) => boolean }[] = [
  {
    label: '홀짝 균형형',
    check: (s) => s.filter(n => n % 2 === 1).length === 3,
  },
  {
    label: '연속 독립형',
    check: (s) => {
      for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1] + 1) return false
      return true
    },
  },
  {
    label: '합계 안정형',
    check: (s) => {
      const sum = s.reduce((a, b) => a + b, 0)
      return sum >= 110 && sum <= 155
    },
  },
  {
    label: '구간 분포형',
    check: (s) => new Set(s.map(n => Math.ceil(n / 10))).size >= 4,
  },
  {
    label: '끝수 균형형',
    check: (s) => new Set(s.map(n => n % 10)).size === s.length,
  },
]

const RECENT_DRAW_COUNT = 50
const COLD_DRAW_COUNT = 15
const AGE_BONUS_WINDOW = 10
const MAX_PICK_ATTEMPTS = 300

function buildFallbackSet(label: string): GeneratedSet {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(Math.floor(Math.random() * 45) + 1)
  const numbers = Array.from(picked).sort((a, b) => a - b)
  return {
    label,
    numbers,
    meta: buildSetMeta(numbers, ['fallback-random']),
  }
}

function getOddCount(numbers: number[]) {
  return numbers.filter(n => n % 2 === 1).length
}

function getConsecutiveRun(numbers: number[]) {
  let maxRun = 1
  let currentRun = 1

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      currentRun += 1
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  return maxRun
}

function getSum(numbers: number[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

function buildSetMeta(numbers: number[], passedRules: string[]) {
  return {
    sum: getSum(numbers),
    oddCount: getOddCount(numbers),
    maxConsecutiveRun: getConsecutiveRun(numbers),
    passedRules,
  }
}

function getZoneCount(numbers: number[]) {
  return new Set(numbers.map(n => Math.ceil(n / 9))).size
}

function passesCommonRules(numbers: number[]) {
  const sum = getSum(numbers)
  const oddCount = getOddCount(numbers)
  const maxConsecutiveRun = getConsecutiveRun(numbers)
  const zoneCount = getZoneCount(numbers)

  return sum >= 110
    && sum <= 170
    && oddCount >= 2
    && oddCount <= 4
    && maxConsecutiveRun < 3
    && zoneCount >= 3
}

function buildWeights(draws: DrawNumbersRow[]) {
  const recentN = Math.min(RECENT_DRAW_COUNT, draws.length)
  const coldN = Math.min(COLD_DRAW_COUNT, draws.length)
  const ageN = Math.min(AGE_BONUS_WINDOW, draws.length)
  const recentDraws = draws.slice(-recentN)
  const coldDraws = recentDraws.slice(-coldN)
  const ageDraws = recentDraws.slice(-ageN)

  const freqMap = new Map<number, number>()
  for (const row of draws)
    for (const col of COLS) freqMap.set(row[col], (freqMap.get(row[col]) ?? 0) + 1)

  const recentMap = new Map<number, number>()
  for (const row of recentDraws)
    for (const col of COLS) recentMap.set(row[col], (recentMap.get(row[col]) ?? 0) + 1)

  // 최근 AGE_BONUS_WINDOW 회차에서 등장한 번호 (과열 패널티용)
  const ageSet = new Set<number>()
  for (const row of ageDraws)
    for (const col of COLS) ageSet.add(row[col])

  const coldSet = new Set<number>()
  for (const row of coldDraws)
    for (const col of COLS) coldSet.add(row[col])

  const maxFreq = Math.max(...freqMap.values(), 1)
  const maxRecent = Math.max(...recentMap.values(), 1)

  return Array.from({ length: 45 }, (_, i) => {
    const num = i + 1
    const freqScore = (freqMap.get(num) ?? 0) / maxFreq
    const recentScore = (recentMap.get(num) ?? 0) / maxRecent
    const isCold = !coldSet.has(num)
    const isOverheat = ageSet.has(num) && (recentMap.get(num) ?? 0) >= 3
    let weight = freqScore * 0.35 + recentScore * 0.65
    if (isCold) weight *= 0.5
    if (isOverheat) weight *= 0.7
    return { num, weight: Math.max(weight, 0.02) }
  })
}

function weightedPick(pool: { num: number; weight: number }[]) {
  const total = pool.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const x of pool) {
    r -= x.weight
    if (r <= 0) return x.num
  }
  return pool[pool.length - 1].num
}

function pickWeightedNumbers(weights: { num: number; weight: number }[]) {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(weightedPick(weights.filter(x => !picked.has(x.num))))
  return Array.from(picked).sort((a, b) => a - b)
}

function pickSet(label: string, weights: { num: number; weight: number }[], check: (s: number[]) => boolean): GeneratedSet {
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights)
    if (passesCommonRules(numbers) && check(numbers)) {
      return {
        label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', label]),
      }
    }
  }

  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights)
    if (passesCommonRules(numbers)) {
      return {
        label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', 'fallback-set-rule-relaxed']),
      }
    }
  }

  return buildFallbackSet(label)
}

function buildGeneratedSets(draws: DrawNumbersRow[]): GeneratedSet[] {
  if (draws.length === 0) {
    return SET_CONFIGS.map(({ label }) => buildFallbackSet(label))
  }

  const weights = buildWeights(draws)
  return SET_CONFIGS.map(({ label, check }) => pickSet(label, weights, check))
}

function countMatches(picked: number[], draw: DrawNumbersRow) {
  const winning = new Set(COLS.map(col => draw[col]))
  let matches = 0
  for (const num of picked) if (winning.has(num)) matches++
  return matches
}

// Sync latest data
app.post('/api/sync', async (c) => {
  try {
    const latestDraw = await getLatestDrawNo()

    const lastEntry: any = await c.env.DB.prepare('SELECT drwNo FROM lotto_history ORDER BY drwNo DESC LIMIT 1').first()
    let currentDrwNo = (lastEntry?.drwNo || 0) + 1
    let syncedCount = 0
    const maxSyncPerRequest = 10
    let lastResult: any = null

    while (currentDrwNo <= latestDraw && syncedCount < maxSyncPerRequest) {
      const result = await fetchLottoResult(currentDrwNo)
      lastResult = result

      if (!result) {
        break
      }

      await c.env.DB.prepare(
        `INSERT INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        result.drwNo, result.drwNoDate, result.drwtNo1, result.drwtNo2, result.drwtNo3,
        result.drwtNo4, result.drwtNo5, result.drwtNo6, result.bnusNo, result.firstWinamnt
      ).run()

      currentDrwNo++
      syncedCount++
    }

    return c.json({
      success: true,
      syncedCount,
      nextDrwNo: currentDrwNo,
      latestDraw,
      debug: lastResult
    })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.post('/api/pension/sync', async (c) => {
  try {
    const requestedLimit = Number(c.req.query('limit') ?? 0)
    const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 100)
      : 0

    const result = await syncPensionResults(c.env.DB, safeLimit)
    return c.json({ success: true, ...result })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.get('/api/pension/results', async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
    const drawNo = c.req.query('drawNo')

    if (drawNo) {
      const row = await c.env.DB.prepare(
        'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws WHERE draw_no = ?'
      ).bind(Number(drawNo)).first()

      if (!row) {
        return c.json({ error: '해당 연금복권 회차 데이터가 없습니다.' }, 404)
      }

      const { results: prizeCounts } = await c.env.DB.prepare(
        'SELECT rank_no, internet_count, store_count, total_count, win_amount, total_amount FROM pension720_prize_counts WHERE draw_no = ? ORDER BY rank_no ASC'
      ).bind(Number(drawNo)).all()

      return c.json({ ...row, prize_counts: prizeCounts })
    }

    const { results } = await c.env.DB.prepare(
      'SELECT draw_no, draw_date, winning_band, winning_number, bonus_number, synced_at FROM pension720_draws ORDER BY draw_no DESC LIMIT ?'
    ).bind(limit).all()

    return c.json(results)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/pension/generate', (c) => {
  try {
    const sets = buildPensionRecommendations()
    return c.json({
      sets,
      algorithm: 'pension-balanced-v1',
      rules: {
        sumRange: '22-34',
        oddCountRange: '2-4',
        minUniqueDigits: 4,
        noThreeConsecutive: true,
        maxDuplicateCount: 2,
      },
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
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
  try {
    const { results: draws } = await c.env.DB.prepare(
      'SELECT drwtNo1,drwtNo2,drwtNo3,drwtNo4,drwtNo5,drwtNo6 FROM lotto_history'
    ).all() as { results: { drwtNo1:number;drwtNo2:number;drwtNo3:number;drwtNo4:number;drwtNo5:number;drwtNo6:number }[] };

    const counts = new Map<number, number>();
    const cols = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const;

    for (const draw of draws) {
      for (const col of cols) {
        const value = draw[col];
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    const hot = Array.from(counts.entries())
      .map(([num, count]) => ({ num, count }))
      .sort((a, b) => b.count - a.count || a.num - b.num)
      .slice(0, 10);

    return c.json(hot);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
})

app.get('/api/generate/backtest', async (c) => {
  try {
    const lookback = Math.min(Math.max(Number(c.req.query('draws') ?? 100), 20), 300)

    const { results } = await c.env.DB.prepare(
      'SELECT drwNo, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo FROM lotto_history ORDER BY drwNo ASC'
    ).all() as { results: DrawNumbersRow[] }

    if (results.length < 40) {
      return c.json({ error: '백테스트에 필요한 데이터가 부족합니다.' }, 400)
    }

    const startIndex = Math.max(30, results.length - lookback)
    const targetDraws = results.slice(startIndex)

    let totalSets = 0
    let totalMatches = 0
    let bestMatchSum = 0
    let bonusHitCount = 0
    let commonRulePassCount = 0
    let relaxedFallbackCount = 0
    let randomFallbackCount = 0
    const hitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
    const bestHitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
    let threePlusCount = 0
    let fourPlusCount = 0
    let fivePlusCount = 0

    for (const target of targetDraws) {
      const train = results.filter(row => (row.drwNo ?? 0) < (target.drwNo ?? 0))
      const sets = buildGeneratedSets(train)
      const matchCounts = sets.map(set => countMatches(set.numbers, target))
      const bestMatch = Math.max(...matchCounts)

      for (let i = 0; i < sets.length; i++) {
        const matches = matchCounts[i]
        const passedRules = sets[i].meta?.passedRules ?? []
        totalSets++
        totalMatches += matches
        hitDistribution[matches]++
        if (passedRules.includes('common-rules')) commonRulePassCount++
        if (passedRules.includes('fallback-set-rule-relaxed')) relaxedFallbackCount++
        if (passedRules.includes('fallback-random')) randomFallbackCount++
        if (matches >= 3) threePlusCount++
        if (matches >= 4) fourPlusCount++
        if (matches >= 5) fivePlusCount++
        if (matches === 5 && sets[i].numbers.includes(target.bnusNo ?? -1)) bonusHitCount++
      }

      bestMatchSum += bestMatch
      bestHitDistribution[bestMatch]++
    }

    return c.json({
      algorithm: 'v3.1',
      evaluatedDraws: targetDraws.length,
      setsPerDraw: SET_CONFIGS.length,
      totalGeneratedSets: totalSets,
      averageMatchPerSet: Number((totalMatches / totalSets).toFixed(3)),
      averageBestMatchPerDraw: Number((bestMatchSum / targetDraws.length).toFixed(3)),
      generationQuality: {
        commonRulePassRate: Number((commonRulePassCount / totalSets * 100).toFixed(2)),
        relaxedFallbackRate: Number((relaxedFallbackCount / totalSets * 100).toFixed(2)),
        randomFallbackRate: Number((randomFallbackCount / totalSets * 100).toFixed(2)),
      },
      setHitRate: {
        match3Plus: Number((threePlusCount / totalSets * 100).toFixed(2)),
        match4Plus: Number((fourPlusCount / totalSets * 100).toFixed(2)),
        match5Plus: Number((fivePlusCount / totalSets * 100).toFixed(2)),
        match5PlusBonus: Number((bonusHitCount / totalSets * 100).toFixed(2)),
      },
      hitDistribution,
      bestHitDistribution,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Generate numbers
app.post('/api/generate', async (c) => {
  try {
    const totalRow: any = await c.env.DB.prepare('SELECT COUNT(*) as n FROM lotto_history').first();
    const total: number = totalRow?.n ?? 0;

    // 데이터 없으면 순수 랜덤 5세트
    if (total === 0) {
      const sets = buildGeneratedSets([])
      return c.json({ sets, algorithm: 'v3.1 (랜덤 - 데이터 없음)' });
    }

    // 전체 회차 조회 (JS에서 집계 — D1 compound SELECT 한계 우회)
    const { results: allDraws } = await c.env.DB.prepare(
      'SELECT drwtNo1,drwtNo2,drwtNo3,drwtNo4,drwtNo5,drwtNo6 FROM lotto_history'
    ).all() as { results: { drwtNo1:number;drwtNo2:number;drwtNo3:number;drwtNo4:number;drwtNo5:number;drwtNo6:number }[] };

    const sets = buildGeneratedSets(allDraws)

    return c.json({ sets, algorithm: 'v3.1' });
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
