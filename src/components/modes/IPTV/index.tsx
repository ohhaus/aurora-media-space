import { useEffect, useMemo, useState } from 'react';
import { parseM3U } from '../../../lib/m3uParser';
import { loadPlaylists, savePlaylists, type Channel, type Playlist } from '../../../lib/indexedDb';
import ChannelPage from './ChannelPage';

function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function seedFromBundled(): Promise<Playlist | null> {
  try {
    const res = await fetch('/IPTVstable.m3u8');
    const text = await res.text();
    const channels = parseM3U(text);
    if (!channels.length) return null;
    return {
      id: 'seed-iptv',
      name: 'IPTV',
      channels,
      source: { kind: 'url', url: '/IPTVstable.m3u8' },
    };
  } catch {
    return null;
  }
}

export default function IPTV() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [modal, setModal] = useState(false);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const saved = await loadPlaylists();
      if (saved && saved.length) {
        setPlaylists(saved);
        setActiveId(saved[0].id);
      } else {
        const seeded = await seedFromBundled();
        if (seeded) {
          setPlaylists([seeded]);
          setActiveId(seeded.id);
          await savePlaylists([seeded]);
        }
      }
    })();
  }, []);

  async function addPlaylist(p: Playlist) {
    const next = [...playlists, p];
    setPlaylists(next);
    await savePlaylists(next);
    setActiveId(p.id);
  }

  async function removePlaylist(id: string) {
    const next = playlists.filter((p) => p.id !== id);
    setPlaylists(next);
    await savePlaylists(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
  }

  const active = playlists.find((p) => p.id === activeId) ?? null;

  const grouped = useMemo(() => {
    if (!active) return new Map<string, Channel[]>();
    const q = query.trim().toLowerCase();
    const map = new Map<string, Channel[]>();
    for (const ch of active.channels) {
      if (q && !ch.name.toLowerCase().includes(q)) continue;
      const g = ch.group || 'Без категории';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(ch);
    }
    return map;
  }, [active, query]);

  if (playing && active) {
    return (
      <ChannelPage
        channel={playing}
        channels={active.channels}
        onPick={(c) => setPlaying(c)}
        onBack={() => setPlaying(null)}
      />
    );
  }

  return (
    <div className="page-shell overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">ТВ</h1>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск канала..."
            className="glass-input text-sm rounded-full px-4 py-2 w-56"
          />
          <button
            onClick={() => setModal(true)}
            className="primary-button"
          >
            + Добавить M3U
          </button>
        </div>
      </div>

      {playlists.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {playlists.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveId(p.id)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  p.id === activeId ? 'bg-white/90 text-black' : 'glass text-neutral-300 hover:text-white'
                }`}
              >
                {p.name} · {p.channels.length}
              </button>
              <button
                onClick={() => removePlaylist(p.id)}
                className="text-neutral-500 hover:text-red-400 text-xs"
                aria-label="Удалить плейлист"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {!active && <div className="text-neutral-400 mt-12 text-center">Добавьте M3U-плейлист.</div>}

      {Array.from(grouped.entries()).map(([group, list]) => (
        <section key={group} className="mb-8">
          <h2 className="text-lg font-bold mb-3">{group}</h2>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
            {list.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setPlaying(ch)}
                className="text-left glass-card transition-all duration-200 p-3 rounded-2xl"
              >
                <div className="aspect-video bg-white/[0.04] rounded-xl mb-3 flex items-center justify-center overflow-hidden text-neutral-500">
                  {ch.logo ? (
                    <img src={ch.logo} alt="" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H7v2h10v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z" />
                    </svg>
                  )}
                </div>
                <div className="text-xs font-semibold truncate">{ch.name}</div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {modal && <AddPlaylistModal onClose={() => setModal(false)} onAdd={addPlaylist} />}
    </div>
  );
}

function AddPlaylistModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (p: Playlist) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl(url)) return setErr('Некорректный URL');
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const channels = parseM3U(text);
      if (!channels.length) throw new Error('Не найдено каналов в плейлисте');
      onAdd({
        id: `pl-${Date.now()}`,
        name: name.trim() || new URL(url).hostname,
        channels,
        source: { kind: 'url', url },
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  }

  async function submitFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const channels = parseM3U(text);
      if (!channels.length) throw new Error('Не найдено каналов в файле');
      onAdd({
        id: `pl-${Date.now()}`,
        name: name.trim() || file.name.replace(/\.[^.]+$/, ''),
        channels,
        source: { kind: 'file' },
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Ошибка чтения');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-panel rounded-3xl p-6 w-[420px] max-w-[90vw]"
      >
        <h2 className="text-xl font-bold mb-4">Добавить M3U</h2>
        <label className="block mb-3">
          <div className="text-xs text-neutral-400 mb-1">Название (необязательно)</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface px-3 py-2 rounded outline-none focus:ring-2 ring-accent/50"
          />
        </label>

        <form onSubmit={submitUrl}>
          <label className="block mb-3">
            <div className="text-xs text-neutral-400 mb-1">URL плейлиста</div>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://.../playlist.m3u"
                className="flex-1 bg-surface px-3 py-2 rounded outline-none focus:ring-2 ring-accent/50"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-2 bg-accent hover:bg-accentHover text-black text-sm font-semibold rounded disabled:opacity-50"
              >
                Загрузить
              </button>
            </div>
          </label>
        </form>

        <div className="text-center text-neutral-500 text-xs my-3">— или —</div>

        <label className="block">
          <div className="text-xs text-neutral-400 mb-1">Файл .m3u / .m3u8</div>
          <input
            type="file"
            accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) submitFile(f);
            }}
            className="text-sm"
          />
        </label>

        {err && <div className="text-red-400 text-sm mt-3">{err}</div>}

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-300 hover:text-white">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
