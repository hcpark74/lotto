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
