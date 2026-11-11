import type { NextDraw } from '../api';
import { describeDrawTarget } from '../format';
import type { SavedPicksState } from '../hooks/useSavedPicks';

// 추천은 세트가 한 번에 나온다. 실제로도 로또 한 장이 A~E 5게임이라 저장 단위도 그게 맞다.
// 낱개 저장 버튼은 일부만 담고 싶을 때를 위해 카드에 그대로 남겨 둔다.
export function SaveAllBar({
    entries,
    state,
    savedKeys,
    onSaved,
    target,
}: {
    entries: { key: string; numbers: number[] | string; label: string | null }[];
    state: SavedPicksState;
    savedKeys: Set<string>;
    onSaved: (keys: string[]) => void;
    // 지금 저장하면 걸리는 회차. 못 받아왔으면 null 이고 회차를 말하지 않는다.
    target: NextDraw | null;
}) {
    const remaining = entries.filter(entry => !savedKeys.has(entry.key));
    // 낱개 저장이 날아가는 중이면 그 세트는 아직 savedKeys 에 없다. 그 사이에 일괄 저장을
    // 누르면 같은 세트가 두 번 들어간다. 저장이 하나라도 진행 중이면 막는다.
    const busy = state.savingKey !== null;
    const allSaved = remaining.length === 0;
    // 저장한 뒤에는 서버가 실제로 담은 회차를 말한다. 이 탭의 picks 는 방금 저장한 것만 들고 있다.
    const savedTo = state.picks[0] ?? null;

    const label = busy
        ? '저장 중...'
        : allSaved
            ? `${entries.length}세트 모두 저장됨`
            : remaining.length === entries.length
                ? `${entries.length}세트 모두 저장`
                : `남은 ${remaining.length}세트 저장`;

    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper px-4 py-3">
            <p className="text-sm text-ink-soft">
                {allSaved ? (
                    <>
                        {savedTo && <><span className="font-semibold text-ink">{describeDrawTarget(savedTo)}</span>에 저장했습니다. </>}
                        내 번호 탭에서 확인할 수 있습니다. 추첨 결과가 들어오면 자동으로 채점됩니다.
                    </>
                ) : target ? (
                    <>
                        <span className="font-semibold text-ink">{describeDrawTarget(target)}</span>에 저장됩니다.
                        낱개로 담으려면 카드의 저장 버튼을 쓰세요.
                    </>
                ) : '한 번에 생성된 세트라 한 번에 저장합니다. 낱개로 담으려면 카드의 저장 버튼을 쓰세요.'}
            </p>
            <button
                type="button"
                onClick={async () => {
                    if (await state.saveAll(SAVE_ALL_KEY, remaining.map(({ numbers, label: setLabel }) => ({ numbers, label: setLabel })))) {
                        onSaved(remaining.map(entry => entry.key));
                    }
                }}
                disabled={busy || allSaved}
                className="btn-primary inline-flex min-h-11 shrink-0 items-center justify-center px-5 text-sm font-semibold"
            >
                {label}
            </button>
        </div>
    );
}

// savingKey 는 화면상의 식별자다. 세트 인덱스와 겹치지 않게 따로 둔다.
const SAVE_ALL_KEY = '__all__';
