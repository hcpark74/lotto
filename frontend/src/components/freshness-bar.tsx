import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useFreshness } from '../hooks/useFreshness';
import type { SyncStatus } from '../api';
import type { PageLottery } from '../types';

function sinceText(iso: string, now: number) {
    const minutes = Math.max(Math.round((now - new Date(iso).getTime()) / 60000), 0);
    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.round(hours / 24)}일 전`;
}

// 자동 갱신이 멈춘 것과 발표가 늦은 것은 다른 문제다. 2026-10-03 에는
// 결과가 낡은 것만 보여서 둘을 구분할 수 없었고, cron 이 죽은 줄 몰랐다.
//
// 붉은 경고는 "데이터가 실제로 틀렸고 사용자가 손쓸 수 있을 때" 만 쓴다.
// cron 이 멈췄어도 새로고침으로 최신이 됐다면 사용자가 할 일은 없다 — 사실만 적는다.
function describe(status: SyncStatus | null, now: number) {
    if (!status) return { text: '추첨 후 자동으로 받아옵니다. 늦으면 직접 받아올 수 있습니다.', alert: false };

    const lastSuccess = status.lastSuccessAt ? sinceText(status.lastSuccessAt, now) : null;
    // 회차가 하나도 없는 DB 에서는 null 이다. 그대로 끼우면 "최신 null회" 가 찍힌다.
    const latest = status.latestDraw == null ? null : `${status.latestDraw}회`;

    if (status.behindSchedule && status.cronOverdue) {
        return {
            text: `자동 갱신이 멈춰 있습니다${lastSuccess ? ` (마지막 성공 ${lastSuccess})` : ''}. 아래 버튼으로 직접 받아올 수 있습니다.`,
            alert: true,
        };
    }

    if (status.behindSchedule) {
        return { text: '추첨은 끝났지만 당첨 결과가 아직 발표되지 않았습니다.', alert: false };
    }

    const head = latest ? `최신 ${latest}` : '받아온 회차가 없습니다';

    if (status.cronOverdue) {
        return { text: `${head} · 자동 갱신은 멈춰 있습니다${lastSuccess ? ` (마지막 성공 ${lastSuccess})` : ''}`, alert: false };
    }

    if (lastSuccess) {
        return { text: `${head} · 마지막 자동 갱신 ${lastSuccess}`, alert: false };
    }

    return { text: latest ? `${head}입니다.` : head, alert: false };
}

export function FreshnessBar({ lottery, onSynced }: { lottery: PageLottery; onSynced: () => void }) {
    const { status, message, refresh, busy } = useFreshness(lottery, onSynced);
    const { text, alert } = describe(status, Date.now());
    // 방금 받아왔다면 사용자가 할 일이 끝난 것이다. 경고색을 유지하면 결과와 어긋난다.
    const warn = alert && !message;

    return (
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-2 border-ink px-3 py-2 ${warn ? 'bg-coral' : 'bg-paper'}`}>
            <p className={`flex items-center gap-1.5 text-xs sm:text-sm ${warn ? 'font-medium text-ink' : 'text-ink-soft'}`}>
                {warn && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {message || text}
            </p>
            <button
                type="button"
                onClick={refresh}
                disabled={busy}
                className="btn-secondary inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm"
            >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                {busy ? '확인 중...' : '최신 회차 확인'}
            </button>
        </div>
    );
}
