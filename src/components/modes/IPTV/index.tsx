import { useEffect, useMemo, useState } from 'react';
import { parseM3U } from '../../../lib/m3uParser';
import { loadPlaylists, savePlaylists, type Channel, type Playlist } from '../../../lib/indexedDb';
import ChannelPage from './ChannelPage';
import ConfirmDialog from '../../ConfirmDialog';

function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

type BundledEntry = { name: string; file: string };

async function loadBundledPlaylists(): Promise<Playlist[]> {
  try {
    const res = await fetch('/iptv/index.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const entries = (await res.json()) as BundledEntry[];
    const out: Playlist[] = [];
    for (const e of entries) {
      try {
        const url = `/iptv/${e.file}`;
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const text = await r.text();
        const channels = parseM3U(text);
        if (!channels.length) continue;
        out.push({
          id: `bundled:${e.file}`,
          name: e.name,
          channels,
          source: { kind: 'bundled', url },
        });
      } catch {
        /* ignore */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default function IPTV() {
  const [bundled, setBundled] = useState<Playlist[]>([]);
  const [user, setUser] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [modal, setModal] = useState(false);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Playlist | null>(null);

  useEffect(() => {
    (async () => {
      const [b, saved] = await Promise.all([loadBundledPlaylists(), loadPlaylists()]);
      setBundled(b);
      // Filter out legacy seed playlist that used to be saved in IDB.
      const userOnly = (saved ?? []).filter(
        (p) => !p.id.startsWith('seed-') && !p.id.startsWith('bundled:'),
      );
      setUser(userOnly);
      const first = b[0]?.id ?? userOnly[0]?.id ?? '';
      setActiveId(first);
    })();
  }, []);

  const playlists = useMemo(() => [...bundled, ...user], [bundled, user]);

  async function addPlaylist(p: Playlist) {
    const next = [...user, p];
    setUser(next);
    await savePlaylists(next);
    setActiveId(p.id);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    if (id.startsWith('bundled:')) return; // shouldn't happen — UI disables
    const next = user.filter((p) => p.id !== id);
    setUser(next);
    await savePlaylists(next);
    if (activeId === id) setActiveId(playlists[0]?.id ?? '');
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
          {playlists.map((p) => {
            const isBundled = p.id.startsWith('bundled:');
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1 rounded-full transition-colors ${
                  p.id === activeId ? 'bg-white text-black' : 'glass'
                }`}
              >
                <button
                  onClick={() => setActiveId(p.id)}
                  className={`px-3 py-1 rounded-full text-sm flex items-center gap-1.5 ${
                    p.id === activeId ? 'text-black' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {isBundled && (
                    <span
                      className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                        p.id === activeId ? 'bg-black/15 text-black/70' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      Bundled
                    </span>
                  )}
                  <span>{p.name}</span>
                  <span className={p.id === activeId ? 'text-black/55' : 'text-white/40'}>· {p.channels.length}</span>
                </button>
                {!isBundled && (
                  <button
                    onClick={() => setPendingDelete(p)}
                    className={`pr-2 pl-0.5 text-xs ${
                      p.id === activeId ? 'text-black/55 hover:text-red-700' : 'text-white/40 hover:text-red-400'
                    }`}
                    aria-label="Удалить плейлист"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!active && <div className="text-white/50 mt-12 text-center">Добавьте M3U-плейлист.</div>}

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
                <div className="aspect-video bg-white/[0.04] rounded-xl mb-3 flex items-center justify-center overflow-hidden text-white/40">
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="Удалить плейлист?"
        message={
          pendingDelete && (
            <>
              <span className="text-white font-semibold">«{pendingDelete.name}»</span>{' '}
              исчезнет из списка ваших IPTV-плейлистов.
            </>
          )
        }
        confirmLabel="Удалить"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
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
        className="liquid-panel rounded-3xl p-6 w-[440px] max-w-[90vw]"
      >
        <h2 className="text-xl font-bold mb-1">Добавить M3U</h2>
        <div className="text-xs text-white/50 mb-4">
          Положите файл в <code className="text-accent">public/iptv/</code>, чтобы он подхватывался
          автоматически при запуске. Или добавьте здесь временно.
        </div>
        <label className="block mb-3">
          <div className="text-xs text-white/50 mb-1">Название (необязательно)</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full px-3 py-2 rounded-xl text-sm"
          />
        </label>

        <form onSubmit={submitUrl}>
          <label className="block mb-3">
            <div className="text-xs text-white/50 mb-1">URL плейлиста</div>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://.../playlist.m3u"
                className="glass-input flex-1 px-3 py-2 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="primary-button disabled:opacity-50"
              >
                Загрузить
              </button>
            </div>
          </label>
        </form>

        <div className="text-center text-white/40 text-xs my-3">— или —</div>

        <label className="block">
          <div className="text-xs text-white/50 mb-1">Файл .m3u / .m3u8</div>
          <input
            type="file"
            accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) submitFile(f);
            }}
            className="text-sm text-white/80"
          />
        </label>

        {err && <div className="text-red-400 text-sm mt-3">{err}</div>}

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="glass-button">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
