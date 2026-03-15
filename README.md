# AI 로또 분석기

동행복권 역대 당첨 데이터를 기반으로 최신 회차, 추천 번호, 자주 나온 번호를 확인하는 서비스입니다.

- `frontend`: React + Vite + TypeScript + Tailwind CSS
- `backend`: Hono + Cloudflare Workers + Cloudflare D1
- 배포 구조: Cloudflare Pages(프론트) + Cloudflare Workers(백엔드)

---

## 현재 화면 구성

### `/lotto`
- 최신 당첨 결과 카드
- AI 추천 번호 5세트
- 자주 나온 번호 통계
- 회차 탐색 및 최근 회차 히스토리
- 번호 색상 안내

### `/pension`
- 연금복권720+ 전용 분리 페이지
- 현재는 화면 전환 구조와 기본 안내 UI만 구성

헤더 메뉴를 통해 `/lotto`, `/pension` 화면을 전환할 수 있습니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite + TypeScript + Tailwind CSS |
| 백엔드 | Cloudflare Workers + Hono |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 배포 | Cloudflare Pages + Cloudflare Workers |

---

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 백엔드 실행

```bash
cd backend
npm run dev
```

- 기본 포트: `8787`

### 3. 프론트엔드 실행

```bash
cd frontend
npm run dev
```

- 기본 포트: `5173`
- 브라우저 접속: `http://localhost:5173/lotto`

---

## 데이터베이스 초기화

최초 1회:

```bash
cd backend
npm run init-db
```

최신 당첨 데이터 동기화:

```bash
# 로컬
curl -X POST http://localhost:8787/api/sync

# 운영
curl -X POST https://lotto-analysis-backend.kbaysin.workers.dev/api/sync
```

참고:
- 한 번에 최대 10회차씩 저장됩니다.
- 1회부터 최신 회차까지 모두 채우려면 여러 번 호출해야 합니다.

---

## 추천 번호 알고리즘

현재 추천 로직은 백엔드 `backend/src/index.ts`에서 동작합니다.

### 기본 흐름
1. 최근 및 전체 당첨 번호 데이터 로드
2. 전체 빈도 + 최근 30회 빈도로 가중치 계산
3. 최근 15회 미출현 번호는 콜드 패널티 적용
4. 가중치 기반 랜덤 추출로 6개 번호 생성
5. 세트별 조건 검증 후 최대 100회 재시도

### 현재 가중치
- 전체 빈도: `40%`
- 최근 30회 빈도: `60%`
- 최근 15회 미출현 번호: 가중치 `50%` 페널티

### 현재 생성 세트
| 세트 | 조건 |
|------|------|
| 홀짝 균형형 | 홀수 정확히 3개 |
| 연속 독립형 | 연속번호 0개 |
| 합계 안정형 | 합계 115 ~ 160 |
| 구간 분포형 | 10단위 구간 4개 이상 분산 |
| 끝수 균형형 | 끝자리 모두 다름 |

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/sync` | 최신 당첨 결과 동기화 |
| `GET` | `/api/results` | 최근 회차 조회 (`?limit=`, `?drwNo=`) |
| `GET` | `/api/stats/hot` | 자주 나온 번호 Top 10 조회 |
| `POST` | `/api/generate` | 추천 번호 5세트 생성 |
| `GET` | `/api/generate/backtest` | 추천 로직 백테스트 |

---

## 경로 전환

프론트는 현재 pathname 기반으로 화면을 전환합니다.

- `/lotto`
- `/pension`

배포 환경에서는 위 경로 직접 진입/새로고침 시 SPA fallback 설정이 필요할 수 있습니다.

---

## 배포

### 백엔드 배포

```bash
cd backend
npm run deploy
```

### 프론트엔드 배포

`frontend/.env.production` 예시:

```env
VITE_API_URL=https://lotto-analysis-backend.kbaysin.workers.dev
CLOUDFLARE_API_TOKEN=<Cloudflare API Token>
```

```bash
cd frontend
npm run deploy
```

---

## 자동 동기화

매주 토요일 기준 자동 동기화는 Workers 스케줄에서 관리합니다.

- 설정 파일: `backend/wrangler.toml`

---

## 주의사항

- 본 서비스는 통계적 참고 도구이며 당첨을 보장하지 않습니다.
- 생성형 알고리즘 사용 사실을 명시합니다.
- 실제 운영 시 `/lotto`, `/pension` 경로에 대한 Pages 라우팅 fallback 설정을 확인해야 합니다.
