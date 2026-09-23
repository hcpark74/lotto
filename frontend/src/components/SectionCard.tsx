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
            <div className={`panel-head flex items-start justify-between gap-3 px-5 py-4 sm:px-6 ${headerClassName}`.trim()}>
                <div>
                    {eyebrow && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">{eyebrow}</p>}
                    <h2 className="mt-1 text-lg font-extrabold text-ink">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    {icon && <div className="panel-icon">{icon}</div>}
                </div>
            </div>
            <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}
