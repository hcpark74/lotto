export type Bindings = {
  DB: D1Database
  // POST /sync 계열 보호용. 운영은 wrangler secret, 로컬은 .dev.vars 로 설정한다.
  ADMIN_TOKEN?: string
  // 구글 OAuth 클라이언트 ID. 공개 값이라 secret 이 아니라 wrangler.toml [vars] 에 둔다.
  // 비어 있으면 로그인 기능이 꺼진 상태로 동작한다 (익명 보관함은 그대로 쓴다).
  GOOGLE_CLIENT_ID?: string
}
