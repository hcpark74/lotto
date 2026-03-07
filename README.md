# AI 로또 분석기

동행복권 역대 당첨 데이터를 분석해 번호를 추천하는 서비스입니다.
Cloudflare 무료 티어로 운영되며 별도 서버 비용이 없습니다.

---

## 화면 구성

| 섹션 | 설명 |
|------|------|
| AI 추천 번호 | 버튼 클릭 시 빈도 가중치 알고리즘으로 번호 6개 생성 |
| 번호 색상 안내 | 번호 범위별 볼 색상 범례 |
| 자주 나오는 번호 | 역대 가장 많이 출현한 번호 Top 6 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React (Vite) + Tailwind CSS |
| 백엔드 | Cloudflare Workers + Hono.js |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 배포 | Cloudflare Pages (프론트) + Workers (백엔드) |

---

## 로컬 개발 환경 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 백엔드 실행 (포트 8787)

```bash
cd backend
npm run dev
```

### 3. 프론트엔드 실행 (포트 5173)

```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 데이터베이스 초기화 (최초 1회)

```bash
cd backend
npm run init-db
```

이후 당첨 데이터 동기화:

```bash
# 로컬
curl -X POST http://localhost:8787/api/sync

# 운영 서버
curl -X POST https://lotto-analysis-backend.kbaysin.workers.dev/api/sync
```

> 한 번에 최대 10회차씩 저장됩니다. 전체 데이터(1회~현재)를 채우려면 여러 번 호출하세요.

---

## 배포

### 백엔드 배포

```bash
cd backend
npm run deploy
```

### 프론트엔드 배포

`frontend/.env.production`에 아래 두 값이 설정되어 있어야 합니다:

```
VITE_API_URL=https://lotto-analysis-backend.kbaysin.workers.dev
CLOUDFLARE_API_TOKEN=<Cloudflare API 토큰>
```

```bash
cd frontend
npm run deploy
```

배포 후 URL: `https://lotto-frontend.pages.dev`

---

## AI 번호 생성 알고리즘 변천사

### v1.0 — 단순 빈도 기반
역대 출현 빈도 상위 10개(핫넘버)를 풀에 2배로 추가해 랜덤 선택.

### v2.0 — 빈도 + 최근 추세 + 기본 필터
- 전체 빈도 40% + 최근 30회 빈도 60% 가중치
- 최근 15회 미출현 번호(콜드넘버) 가중치 50% 페널티
- **필터**: 홀수 2~4개, 연속번호 3개 이상 방지

### ✅ v3.0 — 특성별 5세트 동시 생성 (현재)

v2.0 가중치 구조(전체빈도 40% + 최근30회 60%, 콜드번호 페널티) 유지.
같은 가중치로 각각 다른 조건을 강조한 **6개 번호 조합 5세트**를 동시 생성:

| 세트 | 강조 조건 | 기준 |
|------|-----------|------|
| 홀짝 균형형 | 홀짝 균형 극대화 | 홀수 정확히 3개 |
| 연속 독립형 | 연속번호 완전 배제 | 연속번호 0개 |
| 합계 안정형 | 합계 중앙값 집중 | 합계 115 ~ 160 |
| 구간 분포형 | 넓은 번호 분포 | 5구간 중 4구간 이상 |
| 끝수 균형형 | 끝자리 다양화 | 6개 끝자리 모두 다름 |
| ✨ 종합 균형형 | 위 5개 조건 **모두 충족** | 홀짝+연속+합계+구간+끝수 동시 만족 |

각 세트는 최대 100회 재시도 후 조건 충족 결과 반환.

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/sync` | 최신 당첨 결과 동기화 (최대 10회차) |
| `GET` | `/api/results` | 최근 당첨 결과 조회 (`?limit=`, `?drwNo=`) |
| `GET` | `/api/stats/hot` | 역대 빈도 Top 10 번호 조회 |
| `POST` | `/api/generate` | v3.0 알고리즘으로 번호 6개 생성 |

---

## 자동 동기화

매주 토요일 21:30 (KST) 크론 트리거가 자동으로 최신 회차를 동기화합니다.
`backend/wrangler.toml`에서 일정을 변경할 수 있습니다.

---

## 주의사항

- 본 서비스는 통계적 분석이며 당첨을 보장하지 않습니다.
- 2026 AI 기본법에 따라 생성형 알고리즘 사용 사실을 명시합니다.
- 금전 요구 등 유사수신행위는 불법입니다.
