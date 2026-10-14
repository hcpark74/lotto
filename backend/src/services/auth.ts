// 구글 로그인. 계정이 가진 client_id 를 기기에 넘겨주는 것이 전부다 —
// 기기 연동 코드가 하던 일과 같고, 그래서 저장·채점·조회 경로는 그대로다.
import { verifyGoogleIdToken } from '../algorithms/google-token'
import { createAccountQuery, getAccountQuery, touchAccountQuery } from '../queries/accounts'
import { reassignSavedPicksQuery } from '../queries/transfer-codes'
import { isValidClientId } from './saved-picks'

export type SignInResult = {
  clientId: string
  // 이 기기에 있던 익명 저장분 중 계정으로 옮겨 온 건수
  movedCount: number
  // 이번 로그인으로 계정이 처음 만들어졌는지
  created: boolean
}

export async function signInWithGoogle(
  db: D1Database,
  idToken: string,
  audience: string,
  deviceClientId: string,
  now = new Date(),
): Promise<SignInResult> {
  if (!isValidClientId(deviceClientId)) throw new Error('기기 식별자가 올바르지 않습니다.')

  // 실패하면 던진다. 라우트가 전부 401 로 바꾸므로 사유는 밖으로 나가지 않는다.
  const { sub } = await verifyGoogleIdToken(idToken, audience, now.getTime())

  const at = now.toISOString()
  const existing = await getAccountQuery(db, sub)

  // 처음 로그인하면 지금 기기의 식별자를 계정 것으로 삼는다.
  // 그래야 로그인 전에 저장해 둔 번호가 그대로 이어진다.
  if (!existing) {
    await createAccountQuery(db, { google_sub: sub, client_id: deviceClientId, created_at: at, last_seen_at: at })
    return { clientId: deviceClientId, movedCount: 0, created: true }
  }

  await touchAccountQuery(db, sub, at)

  // 이미 계정의 식별자를 쓰고 있으면 옮길 것이 없다
  if (existing.client_id === deviceClientId) {
    return { clientId: existing.client_id, movedCount: 0, created: false }
  }

  // 이 기기에만 있던 저장분을 계정으로 합친다
  const movedCount = await reassignSavedPicksQuery(db, deviceClientId, existing.client_id)
  return { clientId: existing.client_id, movedCount, created: false }
}
