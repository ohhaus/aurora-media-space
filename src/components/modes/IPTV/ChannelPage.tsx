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

  // F-key shortcut for fullscreen (ignored while typing in inputs/selects)
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
    const set = new Set<string>();
    for (const c of channels) if (c.group) set.add(c.group);
    return Array.from(set).sort();
  }, [channels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (groupFilter !== 'all' && c.group !== groupFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, query, groupFilter]);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
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
            <img src={channel.logo} alt="" className="w-10 h-10 rounded object-contain bg-surface2 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{channel.name}</div>
            {channel.group && <div className="text-xs text-neutral-400 truncate">{channel.group}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={prev}
            className="glass hover:bg-white/10 transition-all w-9 h-9 rounded-full flex items-center justify-center"
            aria-label="Предыдущий канал"
            title="Предыдущий канал"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>
          <span className="text-xs text-neutral-400 px-2 tabular-nums">
            {idx + 1} / {channels.length}
          </span>
          <button
            onClick={next}
            className="glass hover:bg-white/10 transition-all w-9 h-9 rounded-full flex items-center justify-center"
            aria-label="Следующий канал"
            title="Следующий канал"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6h2v12h-2V6zM6 6v12l8.5-6L6 6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: video + side list */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 p-6 min-w-0">
          <VideoPlayer ref={playerRef} channel={channel} />
        </div>

        <aside className="channel-rail w-80 flex flex-col shrink-0 m-3 ml-0 rounded-3xl overflow-hidden">
          <div className="p-3 border-b border-white/[0.08] flex flex-col gap-2 shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск канала..."
              className="glass-input text-sm rounded-full px-3 py-2"
            />
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="glass-input text-sm rounded-xl px-3 py-2"
            >
              <option value="all">Все категории</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const active = c.id === channel.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onPick(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    active ? 'bg-white/[0.11]' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center overflow-hidden text-neutral-500 shrink-0">
                    {c.logo ? (
                      <img src={c.logo} alt="" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H7v2h10v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${active ? 'text-accent' : ''}`}>{c.name}</div>
                    {c.group && <div className="text-[11px] text-neutral-500 truncate">{c.group}</div>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-neutral-500 text-sm p-6 text-center">Нет совпадений</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
