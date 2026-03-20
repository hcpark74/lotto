# Backend Architecture

이 백엔드는 `route -> service -> query/client -> algorithm` 레이어 구조를 기준으로 정리되어 있습니다.

## 목표

- HTTP 처리와 비즈니스 로직을 분리합니다.
- D1 조회/저장과 외부 API 호출을 별도 레이어로 분리합니다.
- 추천 알고리즘은 가능한 한 순수 함수로 유지합니다.
- 도메인별 파일 구조를 로또와 연금복권에 최대한 대칭적으로 맞춥니다.

## 레이어 개요

### 1. `routes/`

HTTP 요청과 응답을 담당합니다.

- 요청 파라미터 읽기
- 상태 코드 결정
- `service` 호출
- 공통 에러 처리 헬퍼 적용

이 레이어에서는 직접 `DB.prepare(...)`나 외부 `fetch(...)`를 호출하지 않습니다.

예시:

- `routes/lotto.ts`
- `routes/pension.ts`

### 2. `services/`

도메인 흐름을 조합합니다.

- 여러 query 호출 결과를 조합
- client 결과를 domain record로 변환
- 알고리즘 호출 순서 결정
- sync/generate/results/backtest 같은 use case 처리

이 레이어는 직접 SQL을 실행하지 않고 `queries/`를 사용합니다.
또한 외부 API를 직접 호출하지 않고 `clients/`를 사용합니다.

예시:

- `services/lotto-sync.ts`
- `services/lotto-generate.ts`
- `services/lotto-backtest.ts`
- `services/pension-sync.ts`

배럴 파일:

- `services/lotto.ts`
- `services/pension.ts`

### 3. `queries/`

Cloudflare D1 접근만 담당합니다.

- `SELECT`, `INSERT`, `UPSERT`
- row 반환
- DB persistence 관련 세부 구현

이 레이어는 비즈니스 판단을 하지 않습니다.

구조:

- `queries/lotto/history.ts`
- `queries/lotto/results.ts`
- `queries/lotto/stats.ts`
- `queries/pension/history.ts`
- `queries/pension/results.ts`

배럴 파일:

- `queries/lotto/index.ts`
- `queries/pension/index.ts`

### 4. `clients/`

외부 복권 API/페이지 접근만 담당합니다.

- 원격 fetch
- 응답 shape 확인
- 외부 데이터 파싱

이 레이어는 DB를 모릅니다.

구조:

- `clients/lotto/history.ts`
- `clients/lotto/results.ts`
- `clients/pension/history.ts`
- `clients/pension/results.ts`

배럴 파일:

- `clients/lotto/index.ts`
- `clients/pension/index.ts`

### 5. `algorithms/`

추천 번호 계산 로직을 담당합니다.

- 가중치 계산
- 규칙 기반 세트 생성
- 연금복권 추천 숫자 생성
- 백테스트에 필요한 순수 계산 보조 함수

가능하면 입력 배열과 숫자만 받아 결과를 돌려주는 형태를 유지합니다.

예시:

- `algorithms/lotto.ts`
- `algorithms/pension.ts`

### 6. `types/`

도메인 타입을 관리합니다.

- 모델/레코드 타입
- query row 타입
- summary/response 타입

구조:

- `types/lotto/models.ts`
- `types/lotto/summaries.ts`
- `types/pension/models.ts`
- `types/pension/summaries.ts`

배럴 파일:

- `types/lotto/index.ts`
- `types/pension/index.ts`

### 7. `utils/`

도메인에 직접 속하지 않는 공통 유틸을 둡니다.

현재는 라우트 공통 에러 처리 헬퍼가 있습니다.

- `utils/route-handler.ts`

## 요청 흐름 예시

### 로또 생성

1. `routes/lotto.ts`가 `/api/generate` 요청을 받음
2. `services/lotto.ts` 배럴을 통해 `generateLottoSetsFromDb` 호출
3. `services/lotto-generate.ts`가 `queries/lotto/*`에서 필요한 데이터 조회
4. `algorithms/lotto.ts`가 추천 세트 계산
5. route가 JSON 응답 반환

### 연금복권 동기화

1. `routes/pension.ts`가 `/api/pension/sync` 요청을 받음
2. `services/pension.ts` 배럴을 통해 `syncPensionResults` 호출
3. `services/pension-sync.ts`가
   - `clients/pension/*`로 외부 데이터 조회
   - `queries/pension/*`로 저장
4. route가 sync summary 응답 반환

## 파일 추가 기준

- 새 HTTP 엔드포인트를 추가하면 먼저 `routes/`에 둡니다.
- DB 조회가 필요하면 `queries/<domain>/...`에 추가합니다.
- 외부 API 호출이 필요하면 `clients/<domain>/...`에 추가합니다.
- 여러 레이어를 묶는 흐름이면 `services/`에 추가합니다.
- 계산 중심 로직이면 `algorithms/`에 추가합니다.
- 응답/모델 타입은 `types/<domain>/...`에 추가합니다.

## 유지 원칙

- route는 얇게 유지합니다.
- service는 흐름을 설명해야 하고 SQL을 포함하지 않습니다.
- query는 데이터 접근만 하고 정책을 담지 않습니다.
- client는 외부 시스템 접근만 담당합니다.
- algorithm은 가능하면 순수 함수로 유지합니다.
