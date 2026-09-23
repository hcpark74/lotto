// 사생활 보호 모드·차단된 사이트 데이터 등에서는 localStorage 접근 자체가 예외를 던진다.
// 저장은 편의 기능이라 실패해도 조용히 넘어간다.
export function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStorage(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // 무시
    }
}
