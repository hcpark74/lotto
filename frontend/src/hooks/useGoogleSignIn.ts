import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuthConfig, signInWithGoogle } from '../api';
import { adoptClientId, resetClientId } from '../clientId';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// 구글 Identity Services 스크립트를 한 번만 넣는다
function loadScript(): Promise<void> {
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GIS_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('구글 로그인 스크립트를 불러오지 못했습니다.'));
        document.head.appendChild(script);
    });
}

type Gis = {
    accounts: {
        id: {
            initialize: (options: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
            renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
            disableAutoSelect: () => void;
        };
    };
};

// 로그인하면 계정이 가진 client_id 를 이어받는다. 그 뒤로는 어느 기기에서 열어도
// 같은 보관함을 본다 — 저장·채점·조회는 전부 client_id 로 돌아가기 때문이다.
export function useGoogleSignIn(onSignedIn: (moved: number) => void) {
    const [clientIdConfig, setClientIdConfig] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const buttonRef = useRef<HTMLDivElement>(null);
    const handler = useRef(onSignedIn);
    handler.current = onSignedIn;

    const handleCredential = useCallback(async (credential: string) => {
        setError('');
        try {
            const result = await signInWithGoogle(credential);
            adoptClientId(result.clientId);
            handler.current(result.movedCount);
        } catch {
            setError('로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const config = await fetchAuthConfig();
                if (cancelled || !config.googleClientId) return;
                setClientIdConfig(config.googleClientId);

                await loadScript();
                if (cancelled) return;

                const gis = (window as unknown as { google?: Gis }).google;
                if (!gis || !buttonRef.current) return;

                gis.accounts.id.initialize({
                    client_id: config.googleClientId,
                    callback: (response) => { if (response.credential) void handleCredential(response.credential); },
                });
                gis.accounts.id.renderButton(buttonRef.current, {
                    theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'ko',
                });
                setReady(true);
            } catch {
                // 로그인은 부가 기능이다. 실패해도 익명 보관함은 그대로 쓸 수 있어야 한다.
                if (!cancelled) setError('구글 로그인을 준비하지 못했습니다.');
            }
        })();

        return () => { cancelled = true; };
    }, [handleCredential]);

    // 로그아웃은 이 기기에서 연결만 끊는다. 서버의 보관함은 그대로 남는다 —
    // 다시 로그인하면 같은 번호를 본다.
    const signOut = useCallback(() => {
        (window as unknown as { google?: Gis }).google?.accounts.id.disableAutoSelect();
        resetClientId();
    }, []);

    return { enabled: clientIdConfig != null, ready, error, buttonRef, signOut };
}
