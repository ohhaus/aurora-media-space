import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel } from '../../../lib/indexedDb';
import VideoPlayer, { type VideoPlayerHandle } from './VideoPlayer';

type Props = {
  channel: Channel;
  channels: Channel[]; // all channels of the active playlist
  onPick: (c: Channel) => void;
  onBack: () => void;
};

export default function ChannelPage({ channel, channels, onPick, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | 'all'>(channel.group ?? 'all');

  const idx = channels.findIndex((c) => c.id === channel.id);
  const prev = () => onPick(channels[(idx - 1 + channels.length) % channels.length]);
  const next = () => onPick(channels[(idx + 1) % channels.length]);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const toggleFullscreen = () => playerRef.current?.toggleFullscreen();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' && e.key !== 'F' && e.key !== 'а' && e.key !== 'А') return;
      const t = e.target as HTMLElement;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      e.preventDefault();
      toggleFullscreen();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of channels) {
      const g = c.group ?? 'Без категории';
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [channels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      const g = c.group ?? 'Без категории';
      if (groupFilter !== 'all' && g !== groupFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, query, groupFilter]);

  return (
    <div className="h-full flex flex-col">
      <div className="liquid-panel flex items-center gap-3 px-5 py-3 shrink-0 m-3 mb-0 rounded-3xl">
        <button
          onClick={onBack}
          className="glass-button-icon"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {channel.logo && (
            <img src={channel.logo} alt="" className="w-10 h-10 rounded-xl object-contain bg-white/[0.05] p-1 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{channel.name}</div>
            {channel.group && <div className="text-xs text-white/40 truncate">{channel.group}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={prev}
            className="glass-button-icon"
            aria-label="Предыдущий канал"
            title="Предыдущий канал"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>
          <span className="text-xs text-white/55 px-2 tabular-nums">
            {idx + 1} / {channels.length}
          </span>
          <button
            onClick={next}
            className="glass-button-icon"
            aria-label="Следующий канал"
            title="Следующий канал"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6h2v12h-2V6zM6 6v12l8.5-6L6 6z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 p-6 min-w-0">
          <VideoPlayer ref={playerRef} channel={channel} />
        </div>

        <aside className="channel-rail w-80 flex flex-col shrink-0 m-3 ml-0 rounded-3xl overflow-hidden">
          <div className="p-3 border-b border-white/[0.08] shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск канала..."
                className="glass-input text-sm rounded-full pl-9 pr-3 py-2 w-full"
              />
            </div>
          </div>

          <div className="px-3 pt-3 pb-2 border-b border-white/[0.06] shrink-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2 px-1">
              Категории
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              <CategoryChip
                active={groupFilter === 'all'}
                onClick={() => setGroupFilter('all')}
                label="Все"
                count={channels.length}
              />
              {groups.map(([g, count]) => (
                <CategoryChip
                  key={g}
                  active={groupFilter === g}
                  onClick={() => setGroupFilter(g)}
                  label={g}
                  count={count}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {filtered.map((c) => {
              const active = c.id === channel.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onPick(c)}
                  className={`group w-full flex items-center gap-3 px-3 py-2 mx-2 my-0.5 rounded-xl text-left transition-all ${
                    active
                      ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.05] border border-white/15'
                      : 'border border-transparent hover:bg-white/[0.05]'
                  }`}
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center overflow-hidden text-white/40 shrink-0">
                    {c.logo ? (
                      <img src={c.logo} alt="" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H7v2h10v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm truncate ${
                        active ? 'text-white font-semibold' : 'text-white/85 group-hover:text-white'
                      }`}
                    >
                      {c.name}
                    </div>
                    {c.group && <div className="text-[11px] text-white/40 truncate">{c.group}</div>}
                  </div>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b3a5ff] shadow-[0_0_8px_rgba(155,140,255,0.7)] shrink-0" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-white/40 text-sm p-6 text-center">Нет совпадений</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
        active
          ? 'bg-white text-black border-white shadow-[0_4px_14px_rgba(255,255,255,0.15)]'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.09] hover:border-white/20'
      }`}
      title={label}
    >
      <span className="max-w-[110px] truncate inline-block align-middle">{label}</span>
      <span className={`ml-1.5 ${active ? 'text-black/55' : 'text-white/40'}`}>{count}</span>
    </button>
  );
}
