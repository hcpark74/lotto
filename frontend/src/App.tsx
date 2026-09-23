import { Info } from 'lucide-react';
import { useLotto } from './hooks/useLotto';
import { usePension } from './hooks/usePension';
import { LottoPage } from './pages/LottoPage';
import { PensionPage } from './pages/PensionPage';
import { TABS, useRoute, type PageKey, type TabKey } from './routing';

function App() {
    const { route, navigate } = useRoute();
    const activePage = route.page;
    const activeTab = route.tab;
    const lotto = useLotto();
    const pension = usePension();

    // 복권 전환 시 탭은 결과로 초기화
    const navigateToPage = (page: PageKey) => navigate({ page, tab: 'results' });
    const navigateToTab = (tab: TabKey) => navigate({ page: activePage, tab });

    return (
        <div className="min-h-screen text-ink">
            <div className="app-shell relative overflow-hidden">

                <header className="relative border-b-2 border-ink bg-card">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                            <img
                                src="/images/logo_dong.svg"
                                alt="동행복권"
                                className="header-brand-logo"
                            />
                            <nav className="header-nav" aria-label="복권 메뉴">
                                <button
                                    type="button"
                                    aria-current={activePage === 'lotto' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'lotto' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('lotto')}
                                >
                                    로또6/45
                                </button>
                                <button
                                    type="button"
                                    aria-current={activePage === 'pension' ? 'page' : undefined}
                                    className={`header-nav-link ${activePage === 'pension' ? 'is-active' : ''}`}
                                    onClick={() => navigateToPage('pension')}
                                >
                                    연금복권720+
                                </button>
                            </nav>
                        </div>
                    </div>
                    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
                        <nav className="tab-nav" aria-label={`${activePage === 'lotto' ? '로또6/45' : '연금복권720+'} 메뉴`}>
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    aria-current={activeTab === tab.key ? 'page' : undefined}
                                    className={`tab-nav-link ${activeTab === tab.key ? 'is-active' : ''}`}
                                    onClick={() => navigateToTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </header>

                <main className="relative mx-auto max-w-7xl px-5 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
                    {activePage === 'lotto'
                        ? <LottoPage lotto={lotto} tab={activeTab} />
                        : <PensionPage pension={pension} tab={activeTab} />}

                    <section className="mt-5 lg:mt-6">
                        <div className="panel flex flex-col gap-2 px-4 py-3 text-[13px] text-ink-soft sm:flex-row sm:items-start sm:px-5 sm:text-sm">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft sm:h-5 sm:w-5" />
                            <p className="leading-5 sm:leading-6">
                                본 서비스는 과거 당첨 데이터를 바탕으로 정보를 정리하고 추천 번호를 제공하는 참고용 도구입니다. 당첨을 보장하지 않으며,
                                건전한 이용을 위해 과도한 몰입은 피하시기 바랍니다. 생성형 알고리즘 사용 사실을 함께 안내합니다.
                            </p>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default App;
