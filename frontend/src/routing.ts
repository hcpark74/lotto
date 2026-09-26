import { useEffect, useState } from 'react';

export type PageKey = 'lotto' | 'pension';
export type TabKey = 'results' | 'picks';
export type Route = { page: PageKey; tab: TabKey };

export const TABS: { key: TabKey; label: string }[] = [
    { key: 'results', label: '결과' },
    { key: 'picks', label: '추천' },
];

// /lotto, /lotto/results, /pension/picks … — 알 수 없는 경로는 /lotto/results 로 취급
function getRouteFromPath(pathname: string): Route {
    const [pageSeg, tabSeg] = pathname.split('/').filter(Boolean);
    const page: PageKey = pageSeg === 'pension' ? 'pension' : 'lotto';
    const tab = TABS.find(t => t.key === tabSeg)?.key ?? 'results';
    return { page, tab };
}

function getPathFromRoute({ page, tab }: Route) {
    return `/${page}/${tab}`;
}

export function useRoute() {
    const [route, setRoute] = useState<Route>(() => getRouteFromPath(window.location.pathname));

    useEffect(() => {
        const handleLocationChange = () => {
            setRoute(getRouteFromPath(window.location.pathname));
        };

        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();

        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const navigate = (next: Route) => {
        const nextPath = getPathFromRoute(next);
        if (window.location.pathname !== nextPath) {
            window.history.pushState({}, '', nextPath);
        }
        setRoute(next);
    };

    return { route, navigate };
}
