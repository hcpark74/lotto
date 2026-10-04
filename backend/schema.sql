CREATE TABLE IF NOT EXISTS lotto_history (
  drwNo INTEGER PRIMARY KEY,
  drwNoDate TEXT,
  drwtNo1 INTEGER,
  drwtNo2 INTEGER,
  drwtNo3 INTEGER,
  drwtNo4 INTEGER,
  drwtNo5 INTEGER,
  drwtNo6 INTEGER,
  bnusNo INTEGER,
  firstWinamnt INTEGER,
  -- 등위별 당첨자 수·총 지급액과 회차 판매액. 인기 조합 회피 모델의 입력이다 (docs/PLAN.md Phase 1).
  -- 추첨 직후에는 집계 전이라 NULL 이고, 이후 동기화에서 채워진다.
  rnk1WnNope INTEGER,
  rnk2WnNope INTEGER,
  rnk3WnNope INTEGER,
  rnk4WnNope INTEGER,
  rnk5WnNope INTEGER,
  rnk1SumWnAmt INTEGER,
  rnk2SumWnAmt INTEGER,
  rnk3SumWnAmt INTEGER,
  rnk4SumWnAmt INTEGER,
  rnk5SumWnAmt INTEGER,
  salesAmount INTEGER,
  -- 1등의 자동/수동/반자동 구매 수
  winType1 INTEGER,
  winType2 INTEGER,
  winType3 INTEGER
);

CREATE TABLE IF NOT EXISTS pension720_draws (
  draw_no INTEGER PRIMARY KEY,
  draw_date TEXT NOT NULL,
  winning_band TEXT NOT NULL,
  winning_number TEXT NOT NULL,
  bonus_number TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  raw_payload TEXT
);

CREATE TABLE IF NOT EXISTS pension720_prize_counts (
  draw_no INTEGER NOT NULL,
  rank_no INTEGER NOT NULL,
  internet_count INTEGER NOT NULL DEFAULT 0,
  store_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  win_amount INTEGER,
  total_amount INTEGER,
  raw_payload TEXT,
  PRIMARY KEY (draw_no, rank_no)
);

-- 연금 당첨 통계 재시도 기록. 통계가 불완전한 회차만 행이 있고, 완결되면 지운다.
CREATE TABLE IF NOT EXISTS pension720_prize_sync_attempts (
  draw_no INTEGER PRIMARY KEY,
  attempts INTEGER NOT NULL,
  last_attempt_at TEXT NOT NULL
);

-- 백테스트 응답 캐시. cache_key 에 최신 회차·행 수가 들어가므로 새 회차가 들어오면 자연히 새 키가 된다.
-- 저장 때 같은 kind 의 더 오래된 데이터 버전(data_latest, data_count) 행을 지운다.
-- (이전 버전의 backtest_cache 테이블은 더 이상 쓰지 않는다)
CREATE TABLE IF NOT EXISTS backtest_cache_v2 (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data_latest INTEGER NOT NULL,
  data_count INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 사용자가 저장한 추천 번호. 로그인이 없으므로 브라우저가 만든 익명 ID(client_id)로 묶는다.
-- client_id 는 사실상 베어러 토큰이라 추측 불가능한 UUID 여야 하고, 서버는 이 값으로만 행을 찾는다.
-- 채점 결과(matched_count·rank_no·checked_at)는 동기화 직후 서버가 채운다.
CREATE TABLE IF NOT EXISTS saved_picks (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  lottery TEXT NOT NULL,
  draw_no INTEGER NOT NULL,
  numbers TEXT NOT NULL,
  label TEXT,
  saved_at TEXT NOT NULL,
  matched_count INTEGER,
  bonus_matched INTEGER,
  rank_no INTEGER,
  checked_at TEXT,
  -- 연금복권 당첨 조(1~5). 같은 6자리가 조마다 있어서, 조에 따라 1등과 2등이 갈린다.
  -- 저장분은 번호만 담으므로 조별 등위를 보여주려면 추첨된 조를 함께 기억해야 한다.
  winning_band TEXT
);

CREATE INDEX IF NOT EXISTS idx_saved_picks_client ON saved_picks (client_id, saved_at DESC);
-- 동기화 후 채점 대상(아직 안 매긴 것)을 복권·회차로 찾는다
CREATE INDEX IF NOT EXISTS idx_saved_picks_pending ON saved_picks (lottery, draw_no, checked_at);

-- 저장한 번호를 다른 기기에서 이어 보기 위한 일회용 코드.
-- 코드 자체가 그 보관함의 열쇠라 원문을 저장하지 않고 SHA-256 해시만 둔다.
-- 수명이 짧고(10분) 한 번 쓰면 지운다.
CREATE TABLE IF NOT EXISTS pick_transfer_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pick_transfer_codes_expiry ON pick_transfer_codes (expires_at);

-- cron 실행 기록. 2026-10-03 에 cron 이 두 번 연속 죽었는데 밖에서 알 길이 없었다 —
-- 결과가 낡은 것만 보였고 "발표가 늦은 것" 인지 "cron 이 죽은 것" 인지 구분되지 않았다.
CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  lottery TEXT NOT NULL,
  cron TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  synced_count INTEGER,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_recent ON cron_runs (lottery, ran_at DESC);

-- 공개 새로고침의 쿨다운 기록
CREATE TABLE IF NOT EXISTS sync_attempts (
  lottery TEXT PRIMARY KEY,
  last_attempt_at TEXT NOT NULL
);
