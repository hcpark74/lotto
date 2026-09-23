import { useEffect, useState } from 'react';

export type Toast = {
    success: (message: string) => void;
    error: (message: string) => void;
    clear: () => void;
};

// 동기화 결과 안내. 3.5초 뒤 자동으로 사라진다.
export function useToast() {
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!message && !error) return;

        const timeout = window.setTimeout(() => {
            setMessage('');
            setError('');
        }, 3500);

        return () => window.clearTimeout(timeout);
    }, [message, error]);

    const toast: Toast = {
        success: text => { setError(''); setMessage(text); },
        error: text => { setMessage(''); setError(text); },
        clear: () => { setMessage(''); setError(''); },
    };

    return { message, error, toast };
}
