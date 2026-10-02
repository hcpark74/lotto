// 로그인이 없어 저장한 번호를 묶을 식별자를 브라우저가 만든다.
// 이 값을 아는 사람은 그 저장분을 읽고 지울 수 있으므로 추측 불가능해야 한다 (UUID v4 = 122비트).
// 서버는 이 값만 보고 행을 찾는다. 기기나 브라우저를 바꾸면 이어지지 않는다.
const KEY = 'lotto-client-id';

function createId() {
    // randomUUID 는 보안 컨텍스트에서만 있다. 없으면 getRandomValues 로 만든다.
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

let cached: string | null = null;

// 시크릿 모드나 저장소 차단 환경에서는 localStorage 가 던진다.
// 그때는 메모리에만 두고 세션 동안만 동작하게 한다 (저장은 되지만 다음 방문에 이어지지 않는다).
export function getClientId() {
    if (cached) return cached;

    try {
        const saved = localStorage.getItem(KEY);
        if (saved) return (cached = saved);
        const created = createId();
        localStorage.setItem(KEY, created);
        return (cached = created);
    } catch {
        return (cached = createId());
    }
}
