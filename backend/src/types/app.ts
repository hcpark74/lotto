export type Bindings = {
  DB: D1Database
  // POST /sync 계열 보호용. 운영은 wrangler secret, 로컬은 .dev.vars 로 설정한다.
  ADMIN_TOKEN?: string
}
