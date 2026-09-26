import type { ReactNode } from 'react';

export function SectionCard({
    title,
    icon,
    eyebrow,
    action,
    children,
    accent = 'default',
    headerClassName = '',
    bodyClassName = '',
}: {
    title: string;
    icon?: ReactNode;
    eyebrow?: string;
    action?: ReactNode;
    children: ReactNode;
    accent?: 'default' | 'soft';
    headerClassName?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={`panel ${accent === 'soft' ? 'panel-soft' : ''}`}>
            {/* 좁은 화면에서는 제목이 접히지 않도록 액션을 아래 줄로 내린다 */}
            <div className={`panel-head flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 ${headerClassName}`.trim()}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {eyebrow && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">{eyebrow}</p>}
                        <h2 className="mt-1 text-lg font-extrabold text-ink">{title}</h2>
                    </div>
                    {icon && <div className="panel-icon shrink-0 sm:hidden">{icon}</div>}
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                    {action}
                    {icon && <div className="panel-icon hidden sm:inline-flex">{icon}</div>}
                </div>
            </div>
            <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}
