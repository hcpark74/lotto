import { useState } from 'react';
import { adoptClientId } from '../clientId';
import { ApiError, claimTransferCode, issueTransferCode } from '../api';

// 로그인이 없어 저장분은 브라우저가 만든 식별자에 묶인다. 다른 기기에서 이어 보려면
// 그 식별자를 넘겨야 하는데, 값을 그대로 보여주면 받아 적다 틀리기 쉽고 수명도 없다.
// 짧은 일회용 코드(10분)를 만들어 교환한다.
export function DeviceLink({ onLinked }: { onLinked: () => void }) {
    const [code, setCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [issuing, setIssuing] = useState(false);

    const [input, setInput] = useState('');
    const [claiming, setClaiming] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const issue = async () => {
        setIssuing(true);
        setError('');

        try {
            const issued = await issueTransferCode();
            setCode(issued.code);
            setExpiresAt(issued.expiresAt);
        } catch {
            setError('코드를 만들지 못했습니다.');
        } finally {
            setIssuing(false);
        }
    };

    const claim = async () => {
        setClaiming(true);
        setError('');
        setMessage('');

        try {
            const result = await claimTransferCode(input);
            // 이 브라우저가 원래 기기의 식별자를 이어받는다. 이후 두 기기가 같은 보관함을 본다.
            adoptClientId(result.clientId);
            setInput('');
            setMessage(result.movedCount > 0
                ? `보관함을 이어받았습니다. 이 기기에 있던 ${result.movedCount}건도 함께 합쳤습니다.`
                : '보관함을 이어받았습니다.');
            onLinked();
        } catch (err) {
            setError(err instanceof ApiError && err.message ? err.message : '코드를 확인하지 못했습니다.');
        } finally {
            setClaiming(false);
        }
    };

    const expiryText = expiresAt
        ? new Date(expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <div className="mt-5 border-2 border-ink bg-paper p-4 sm:p-5 lg:mt-6">
            <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-ink">다른 기기에서 보기</p>
            <h3 className="mt-1 text-lg font-extrabold text-ink">기기 연동</h3>
            <p className="mt-2 text-sm text-ink-soft">
                이 기기에서 코드를 만들어 다른 기기에 입력하면 같은 보관함을 보게 됩니다.
                코드는 10분 동안만 쓸 수 있고 한 번 쓰면 사라집니다.
            </p>

            {error && <p className="mt-3 border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">{error}</p>}
            {message && <p className="mt-3 border-2 border-ink bg-mint px-3 py-2 text-sm font-medium">{message}</p>}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="border-2 border-ink bg-card px-4 py-4">
                    <p className="text-sm font-semibold text-ink">1. 이 기기에서 코드 만들기</p>
                    {code ? (
                        <>
                            <p className="mt-3 font-mono text-3xl font-bold tracking-[0.08em] text-ink">{code}</p>
                            <p className="mt-2 text-xs text-ink-soft">{expiryText}까지 유효합니다. 다른 기기에 입력하세요.</p>
                        </>
                    ) : (
                        <p className="mt-2 text-xs text-ink-soft">코드를 만들면 여기에 표시됩니다.</p>
                    )}
                    <button
                        type="button"
                        onClick={issue}
                        disabled={issuing}
                        className="btn-secondary mt-3 inline-flex min-h-11 items-center justify-center px-4 text-sm"
                    >
                        {issuing ? '만드는 중...' : code ? '새 코드 만들기' : '코드 만들기'}
                    </button>
                </div>

                <div className="border-2 border-ink bg-card px-4 py-4">
                    <label htmlFor="transfer-code" className="text-sm font-semibold text-ink">2. 다른 기기의 코드 입력</label>
                    <div className="mt-3 flex gap-2">
                        <input
                            id="transfer-code"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && input.trim() && claim()}
                            placeholder="ABCDE-23456"
                            autoComplete="off"
                            className="input-brutal h-11 w-full px-3 text-sm uppercase"
                        />
                        <button
                            type="button"
                            onClick={claim}
                            disabled={claiming || input.trim().length === 0}
                            className="btn-primary inline-flex h-11 shrink-0 items-center justify-center px-4 text-sm font-semibold transition"
                        >
                            {claiming ? '확인 중...' : '불러오기'}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">
                        이 기기에 저장해 둔 번호가 있으면 함께 합쳐집니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
