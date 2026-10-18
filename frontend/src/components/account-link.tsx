import { useState } from 'react';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { DeviceLink } from './device-link';

// 구글 로그인. 계정이 보관함 하나를 소유하고, 로그인하면 그 보관함을 이어받는다 —
// 그래서 폰에서 저장한 번호가 PC 에서도 그대로 보인다.
//
// 저장하는 개인정보는 없다. 서버는 구글이 준 식별자(sub)만 두고 이메일·이름은 버린다.
export function AccountLink({ onChanged }: { onChanged: () => void }) {
    const [message, setMessage] = useState('');

    const { enabled, ready, linked, error, buttonRef, signOut } = useGoogleSignIn((moved) => {
        setMessage(moved > 0
            ? `로그인했습니다. 이 기기에 있던 ${moved}건을 계정으로 합쳤습니다.`
            : '로그인했습니다. 어느 기기에서 열어도 같은 번호가 보입니다.');
        onChanged();
    });

    // 클라이언트 ID 가 설정되지 않은 배포에서는 일회용 코드가 유일한 길이라 그대로 펼친다.
    if (!enabled) return <DeviceLink onLinked={onChanged} />;

    return (
        <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5 lg:mt-6">
            <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">어디서든 같은 번호</p>
            <h3 className="mt-1 text-lg font-extrabold text-ink">구글 계정 연결</h3>
            <p className="mt-2 text-sm text-ink-soft">
                로그인하면 저장한 번호가 계정에 묶입니다. 다른 기기에서 같은 계정으로 들어오면
                그대로 이어집니다. 저장하는 개인정보는 없습니다 — 계정을 구분할 식별자만 두고
                이메일과 이름은 보관하지 않습니다.
            </p>

            {linked && !message && (
                <p className="mt-3 border-2 border-ink bg-mint px-3 py-2 text-sm font-medium">
                    이 기기는 계정에 연결되어 있습니다.
                </p>
            )}

            {error && <p className="mt-3 border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">{error}</p>}
            {message && <p className="mt-3 border-2 border-ink bg-mint px-3 py-2 text-sm font-medium">{message}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div ref={buttonRef} className="min-h-11" />
                {!ready && !error && <span className="text-xs text-ink-soft">불러오는 중...</span>}
                {/* 연결한 적이 없으면 숨긴다. 익명 상태에서 누르면 새 식별자가 발급되면서
                    지금 보고 있는 저장분이 조용히 끊긴다 — 되돌릴 방법도 없다. */}
                {linked && (
                    <button
                        type="button"
                        onClick={() => {
                            signOut();
                            setMessage('이 기기에서 연결을 끊었습니다. 저장한 번호는 계정에 남아 있습니다.');
                            onChanged();
                        }}
                        className="btn-secondary inline-flex min-h-11 items-center justify-center px-4 text-sm"
                    >
                        이 기기에서 연결 끊기
                    </button>
                )}
            </div>

            {/* 일회용 코드는 같은 일을 더 번거롭게 한다 — 두 기기를 10분 안에 함께 열고 코드를
                받아 적어야 한다. 계정을 연결하고 싶지 않거나 로그인 버튼이 뜨지 않는 경우를
                위해 남겨 두되, 동등한 선택지 자리에서는 뺀다. */}
            <details className="mt-5 border-t-2 border-ink pt-4">
                <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">
                    계정 연결 없이 다른 기기로 옮기기
                </summary>
                <p className="mt-2 text-sm text-ink-soft">
                    이 기기에서 일회용 코드를 만들어 다른 기기에 입력합니다. 코드는 10분 동안만
                    쓸 수 있고 한 번 쓰면 사라집니다. 로그인과 달리 두 기기를 함께 열어 둬야 합니다.
                </p>
                <DeviceLink onLinked={onChanged} inline />
            </details>
        </div>
    );
}
