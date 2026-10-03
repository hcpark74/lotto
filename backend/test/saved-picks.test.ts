import { describe, expect, it } from 'vitest'
import { gradeLottoPick, gradePensionPick, lottoRankOf, PENSION_BONUS_RANK } from '../src/algorithms/saved-picks'
import { isValidClientId, normalizeNumbers, toSavedPick } from '../src/services/saved-picks'
import type { SavedPickRow } from '../src/types/saved-picks'

// 등위 정의는 dhlottery.co.kr 에서 확인한 값이다 (2026-09-30).
// 로또: 6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등
describe('lottoRankOf', () => {
  it('6개 일치는 1등', () => expect(lottoRankOf(6, false)).toBe(1))
  it('5개 + 보너스는 2등', () => expect(lottoRankOf(5, true)).toBe(2))
  it('5개만이면 3등', () => expect(lottoRankOf(5, false)).toBe(3))
  it('4개는 4등', () => expect(lottoRankOf(4, false)).toBe(4))
  it('3개는 5등', () => expect(lottoRankOf(3, false)).toBe(5))
  it('2개 이하는 낙첨', () => {
    expect(lottoRankOf(2, true)).toBeNull()
    expect(lottoRankOf(0, false)).toBeNull()
  })
})

describe('gradeLottoPick', () => {
  const winning = [13, 15, 19, 21, 44, 45]
  const bonus = 39

  it('전부 맞으면 1등', () => {
    expect(gradeLottoPick(winning, winning, bonus)).toEqual({ matchedCount: 6, bonusMatched: false, rankNo: 1 })
  })

  it('5개 + 보너스는 2등', () => {
    expect(gradeLottoPick([13, 15, 19, 21, 44, 39], winning, bonus))
      .toEqual({ matchedCount: 5, bonusMatched: true, rankNo: 2 })
  })

  it('5개만 맞으면 3등', () => {
    expect(gradeLottoPick([13, 15, 19, 21, 44, 1], winning, bonus))
      .toEqual({ matchedCount: 5, bonusMatched: false, rankNo: 3 })
  })

  // 보너스 번호는 당첨번호가 아니므로 일치 개수에 세지 않는다
  it('보너스만 맞고 본번호 2개면 낙첨', () => {
    expect(gradeLottoPick([13, 15, 1, 2, 3, 39], winning, bonus))
      .toEqual({ matchedCount: 2, bonusMatched: true, rankNo: null })
  })
})

// 연금: 끝자리부터 연속 일치한 자리 수로 2~7등. 추천은 조를 고르지 않아 1등은 판정하지 않는다.
describe('gradePensionPick', () => {
  it('6자리 전부 일치는 2등', () => {
    expect(gradePensionPick('956029', '956029', '022049'))
      .toEqual({ matchedCount: 6, bonusMatched: false, rankNo: 2 })
  })

  it('끝 3자리 일치는 5등', () => {
    expect(gradePensionPick('111029', '956029', '022049'))
      .toEqual({ matchedCount: 3, bonusMatched: false, rankNo: 5 })
  })

  it('끝 1자리 일치는 7등', () => {
    expect(gradePensionPick('111119', '956029', '022049'))
      .toEqual({ matchedCount: 1, bonusMatched: false, rankNo: 7 })
  })

  it('하나도 안 맞으면 낙첨', () => {
    expect(gradePensionPick('111111', '956029', '022049'))
      .toEqual({ matchedCount: 0, bonusMatched: false, rankNo: null })
  })

  it('보너스 번호와 6자리가 맞으면 보너스 등위', () => {
    const result = gradePensionPick('022049', '956029', '022049')
    expect(result.bonusMatched).toBe(true)
    expect(result.rankNo).toBe(PENSION_BONUS_RANK)
  })

  it('보너스가 없는 회차도 처리한다', () => {
    expect(gradePensionPick('956029', '956029', null).rankNo).toBe(2)
  })
})

describe('normalizeNumbers', () => {
  it('로또 번호는 정렬해 저장한다', () => {
    expect(normalizeNumbers('lotto', [45, 1, 20, 3, 44, 2])).toBe('1,2,3,20,44,45')
  })

  it('로또는 1~45 밖이거나 중복이면 거부', () => {
    expect(normalizeNumbers('lotto', [0, 1, 2, 3, 4, 5])).toBeNull()
    expect(normalizeNumbers('lotto', [1, 2, 3, 4, 5, 46])).toBeNull()
    expect(normalizeNumbers('lotto', [1, 1, 2, 3, 4, 5])).toBeNull()
    expect(normalizeNumbers('lotto', [1, 2, 3, 4, 5])).toBeNull()
  })

  it('연금은 숫자 6자리만 받는다', () => {
    expect(normalizeNumbers('pension', '012345')).toBe('012345')
    expect(normalizeNumbers('pension', '12345')).toBeNull()
    expect(normalizeNumbers('pension', '12345a')).toBeNull()
  })
})

// 익명 ID 가 곧 권한이라 짧은 값은 거부한다
describe('isValidClientId', () => {
  it('UUID 는 통과', () => expect(isValidClientId(crypto.randomUUID())).toBe(true))
  it('짧거나 이상한 값은 거부', () => {
    expect(isValidClientId('short')).toBe(false)
    expect(isValidClientId(undefined)).toBe(false)
    expect(isValidClientId('a'.repeat(65))).toBe(false)
    expect(isValidClientId('../../etc/passwd')).toBe(false)
  })
})

describe('toSavedPick', () => {
  const base: SavedPickRow = {
    id: 'x', client_id: 'c', lottery: 'lotto', draw_no: 1243, numbers: '1,2,3,4,5,6',
    label: '구간 분포형', saved_at: '2026-09-26T00:00:00.000Z',
    matched_count: null, bonus_matched: null, rank_no: null, checked_at: null, winning_band: null,
  }

  it('client_id 는 응답에 넣지 않는다', () => {
    expect(toSavedPick(base)).not.toHaveProperty('client_id')
  })

  it('채점 전에는 result 가 null', () => {
    expect(toSavedPick(base).result).toBeNull()
  })

  it('채점 후에는 result 를 채운다', () => {
    const graded = toSavedPick({ ...base, matched_count: 3, bonus_matched: 0, rank_no: 5, checked_at: '2026-09-27T00:00:00.000Z' })
    expect(graded.result).toEqual({ matchedCount: 3, bonusMatched: false, rankNo: 5, checkedAt: '2026-09-27T00:00:00.000Z', winningBand: null })
  })

  // 연금은 같은 6자리가 1~5조에 모두 있어 조에 따라 1등과 2등이 갈린다.
  // 조별 등위를 보여주려면 추첨된 조가 결과에 들어 있어야 한다.
  it('연금은 당첨 조를 함께 돌려준다', () => {
    const graded = toSavedPick({
      ...base, lottery: 'pension', numbers: '259311',
      matched_count: 6, bonus_matched: 0, rank_no: 2,
      checked_at: '2026-10-02T00:00:00.000Z', winning_band: '4',
    })
    expect(graded.result?.winningBand).toBe('4')
  })

  // 운영 테이블에 열이 생기기 전 행은 undefined 로 읽힌다
  it('당첨 조 열이 없던 행은 null 로 돌려준다', () => {
    const row = { ...base, matched_count: 3, bonus_matched: 0, rank_no: 5, checked_at: '2026-09-27T00:00:00.000Z' }
    delete (row as { winning_band?: unknown }).winning_band
    expect(toSavedPick(row).result?.winningBand).toBeNull()
  })
})
