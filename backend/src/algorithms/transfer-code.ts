// 사람이 받아 적는 코드라 길이를 제한해야 한다. 0/1/I/O 처럼 헷갈리는 글자는 뺀다.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CODE_LENGTH = 10
export const CODE_TTL_MINUTES = 10

// 32^10 ≈ 1.1e15. 활성 코드가 1000개 떠 있고 100만 번 찍어도 적중 확률 ~9e-7.
// (8자리는 같은 가정에서 ~9e-4 라 부족하다.)
export function createTransferCode(randomBytes: Uint8Array) {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomBytes[i] % ALPHABET.length]
  return code
}

// 입력은 공백·하이픈·소문자를 허용하고 비교 전에 정규화한다
export function normalizeTransferCode(raw: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.length === CODE_LENGTH && [...cleaned].every((c) => ALPHABET.includes(c)) ? cleaned : null
}

// 보기 좋게 5-5 로 끊는다
export function formatTransferCode(code: string) {
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

export async function hashTransferCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
