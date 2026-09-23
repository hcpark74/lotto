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
  firstWinamnt INTEGER
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
