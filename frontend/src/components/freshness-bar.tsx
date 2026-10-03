import { RefreshCw } from 'lucide-react';
import { useFreshness } from '../hooks/useFreshness';
import type { PageLottery } from '../types';

// 최신 회차가 제때 들어왔는지 보여주고, 안 들어왔으면 직접 받아올 수 있게 한다.
// 자동 시도가 조용히 성공하는 경우가 대부분이라 평소에는 버튼 한 줄만 보인다.
export function FreshnessBar({ lottery, onSynced }: { lottery: PageLottery; onSynced: () => void }) {
    const { message, refresh, busy } = useFreshness(lottery, onSynced);

    return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-paper px-3 py-2">
            <p className="text-xs text-ink-soft sm:text-sm">
                {message || '추첨 후 자동으로 받아옵니다. 늦으면 직접 받아올 수 있습니다.'}
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
