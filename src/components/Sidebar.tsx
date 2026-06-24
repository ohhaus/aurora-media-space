export type Mode = 'music' | 'radio' | 'iptv' | 'audiobooks' | 'storage' | 'guide';

type Props = { mode: Mode; onChange: (m: Mode) => void };

const ITEMS: { id: Exclude<Mode, 'guide'>; label: string; icon: JSX.Element }[] = [
  {
    id: 'music',
    label: 'Моя музыка',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
      </svg>
    ),
  },
  {
    id: 'radio',
    label: 'Радио',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.33-.75-1.86L3.24 6.15zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h2v2z" />
      </svg>
    ),
  },
  {
    id: 'iptv',
    label: 'ТВ',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H7v2h10v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z" />
      </svg>
    ),
  },
  {
    id: 'audiobooks',
    label: 'Аудиокниги',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h2v10l-1-.75L8 14V4zm10 16H6v-1h12v1zm0-3H6V4h2v14l3-2.25L14 18V4h4v13z" />
      </svg>
    ),
  },
  {
    id: 'storage',
    label: 'Хранилище',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3C7.03 3 3 4.79 3 7v10c0 2.21 4.03 4 9 4s9-1.79 9-4V7c0-2.21-4.03-4-9-4zm0 2c4.42 0 7 1.34 7 2s-2.58 2-7 2-7-1.34-7-2 2.58-2 7-2zm0 14c-4.42 0-7-1.34-7-2v-2.25C6.65 15.54 9.15 16 12 16s5.35-.46 7-1.25V17c0 .66-2.58 2-7 2zm0-5c-4.42 0-7-1.34-7-2V9.75C6.65 10.54 9.15 11 12 11s5.35-.46 7-1.25V12c0 .66-2.58 2-7 2z" />
      </svg>
    ),
  },
];

export default function Sidebar({ mode, onChange }: Props) {
  return (
    <aside className="sidebar-shell w-60 flex flex-col py-5 px-3 shrink-0 m-3 mr-0">
      <div className="px-4 mb-8 flex items-center gap-2 font-bold text-lg">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 16.5c3.3 0 3.9-9 7.2-9 2.1 0 2.4 4.5 4.8 4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <circle cx="6" cy="16.5" r="2" fill="white"/>
            <circle cx="18" cy="12" r="2" fill="white"/>
          </svg>
        </div>
        <div>
          <div className="tracking-tight">Aurora</div>
          <div className="text-[9px] uppercase tracking-[0.24em] text-white/35 font-medium">media space</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1.5">
        {ITEMS.map((it) => {
          const active = it.id === mode;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`nav-item ${
                active
                  ? 'nav-item-active'
                  : ''
              }`}
            >
              <span>{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-white/[0.07]">
        <button
          onClick={() => onChange('guide')}
          className={`nav-item w-full ${mode === 'guide' ? 'nav-item-active' : ''}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z" />
          </svg>
          Гайд
        </button>
        <div className="px-4 pt-4 text-[10px] text-white/25">Данные остаются на устройстве</div>
      </div>
    </aside>
  );
}
