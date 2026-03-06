import React, { useState, useEffect } from 'react';
import { Sparkles, History, TrendingUp, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

function App() {
    const [numbers, setNumbers] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [hotNumbers, setHotNumbers] = useState<number[]>([]);
    const [algorithm, setAlgorithm] = useState("v1.0");

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_URL}/api/stats/hot`);
                if (res.ok) {
                    const data = await res.json();
                    setHotNumbers(data.slice(0, 5).map((d: any) => d.num));
                }
            } catch (e) {
                console.error("Failed to fetch stats:", e);
            }
        };
        fetchStats();
    }, []);

    const generateNumbers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/generate`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setNumbers(data.numbers);
                setAlgorithm(data.algorithm);
            } else {
                throw new Error("API failed");
            }
        } catch (e) {
            console.error("Failed to generate numbers:", e);
            // Fallback for local development if server is not running
            const nums = Array.from({ length: 6 }, () => Math.floor(Math.random() * 45) + 1).sort((a, b) => a - b);
            setNumbers(nums);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-4 md:p-8">
            <header className="max-w-2xl mx-auto text-center mb-12">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-violet-600 bg-clip-text text-transparent mb-2">
                    AI 로또 분석기
                </h1>
                <p className="text-slate-400">데이터 기반 알고리즘으로 생성하는 행운의 번호</p>
            </header>

            <main className="max-w-2xl mx-auto space-y-8">
                {/* Number Display */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
                    <div className="flex justify-center gap-2 md:gap-4 mb-8 h-12">
                        {numbers.length > 0 ? (
                            numbers.map((num, i) => (
                                <div key={i} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-lotto-primary flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/20 animate-in fade-in zoom-in duration-300">
                                    {num}
                                </div>
                            ))
                        ) : (
                            <div className="text-slate-500 flex items-center italic">번호를 생성해 보세요</div>
                        )}
                    </div>

                    <button
                        onClick={generateNumbers}
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                번호 생성하기
                            </>
                        )}
                    </button>

                    {numbers.length > 0 && (
                        <div className="mt-4 text-xs text-purple-400 font-medium">
                            AI 알고리즘 생성 ({algorithm})
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-medium">자주 나오는 번호</span>
                        </div>
                        <div className="text-lg font-bold">
                            {hotNumbers.length > 0 ? hotNumbers.join(', ') : '1, 27, 43...'}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <History className="w-4 h-4" />
                            <span className="text-sm font-medium">최근 미출현</span>
                        </div>
                        <div className="text-lg font-bold">12, 35, 9...</div>
                    </div>
                </div>
            </main>

            <footer className="max-w-2xl mx-auto mt-16 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-amber-500 bg-amber-500/10 py-2 px-4 rounded-lg inline-flex">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">법적 고지</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                    본 서비스는 통계적 분석일 뿐 당첨을 보장하지 않습니다. 과몰입에 주의하세요.<br />
                    2026 AI 기본법을 준수하여 생성형 알고리즘이 사용되었음을 명시합니다.
                </p>
            </footer>
        </div>
    );
}

export default App;
