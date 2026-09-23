import { useRef, useState } from 'react';
import { describeDrawLookupError } from '../api';
import { parseDrawNo } from '../format';

// 회차 검색 (로또·연금 공통). 응답이 늦게 도착해도 마지막 요청의 결과만 반영한다.
// 예: 1100 을 검색하고 바로 1101 을 검색했는데 1100 응답이 나중에 오면 무시한다.
export function useDrawSearch<T>(fetcher: (drawNo: number) => Promise<T>) {
    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<T | null>(null);
    const [searchError, setSearchError] = useState('');
    const latestRequest = useRef(0);

    const changeSearchInput = (value: string) => {
        // 입력이 바뀌면 진행 중인 요청의 결과도 더 이상 맞지 않는다
        latestRequest.current += 1;
        setSearchInput(value);
        setSearchResult(null);
        setSearchError('');
    };

    const search = async () => {
        const no = parseDrawNo(searchInput);
        if (no === null) return;

        const requestId = ++latestRequest.current;
        setSearchError('');
        setSearchResult(null);

        try {
            const data = await fetcher(no);
            if (requestId === latestRequest.current) setSearchResult(data);
        } catch (error) {
            if (requestId === latestRequest.current) setSearchError(describeDrawLookupError(error, no));
        }
    };

    return { searchInput, searchResult, searchError, changeSearchInput, search };
}
