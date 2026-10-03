// D1(SQLite)은 "없는 열" 을 문장 종류마다 다른 문구로 알린다. 실측값:
//   INSERT INTO t (a, nocol) ...  →  table t has no column named nocol: SQLITE_ERROR
//   SELECT nocol FROM t           →  no such column: nocol at offset 7: SQLITE_ERROR
//   UPDATE t SET nocol = 1        →  no such column: nocol ...
// 한쪽만 보고 있으면 지연 ALTER TABLE 이 안 돌아 그 경로가 통째로 실패한다 —
// 실제로 INSERT 문구를 놓쳐 2026-10-03 토요일 cron 이 동기화에서 죽었다.
const PATTERNS = /no such column|has no column named/i

export function isMissingColumnError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause
    return PATTERNS.test(`${error.message} ${String(cause ?? '')}`)
  }
  return PATTERNS.test(String(error))
}
