import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBlob } from 'music-metadata';
import JSZip from 'jszip';
import { usePlayer, type Track } from '../../../store/playerStore';
import EqualizerAnimation from '../../EqualizerAnimation';
import ConfirmDialog from '../../ConfirmDialog';
import {
  isAudioFilename,
  isMacOsMetadataPath,
  supportsFileSystemAccess,
  ensurePermission,
  walkAudio,
} from '../../../lib/fileSystem';
import {
  loadDirHandle,
  saveDirHandle,
  clearDirHandle,
  loadFileHandles,
  saveFileHandles,
  loadMusicPlaylists,
  saveMusicPlaylists,
  loadMusicZips,
  saveMusicZips,
  loadHiddenMusicTracks,
  saveHiddenMusicTracks,
  type MusicPlaylist,
  type StoredMusicZip,
} from '../../../lib/indexedDb';

type LibTrack = Track & {
  search: string;
  /** Top-level subfolder name (used to build auto-playlists). null = root. */
  topFolder: string | null;
  addedAt: number;
};

type SortKey = 'recent' | 'name-asc' | 'name-desc' | 'artist';
type ViewMode = 'grid' | 'list';

function basename(path: string) {
  return path.split('/').pop() ?? path;
}

async function metaFromFile(
  file: File,
  id: string,
  topFolder: string | null,
  addedAt: number,
  resolveSrc: () => Promise<string>,
  options: { skipCovers?: boolean } = {},
): Promise<LibTrack> {
  let title = file.name.replace(/\.[^.]+$/, '');
  let artist: string | undefined;
  let album: string | undefined;
  let artwork: string | undefined;
  try {
    const m = await parseBlob(file, { duration: false, skipCovers: options.skipCovers ?? false });
    title = m.common.title || title;
    artist = m.common.artist;
    album = m.common.album;
    const pic = m.common.picture?.[0];
    if (pic) {
      const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format });
      artwork = URL.createObjectURL(blob);
    }
  } catch {
    /* ignore metadata errors */
  }
  return {
    id,
    title,
    artist,
    album,
    artwork,
    resolveSrc,
    topFolder,
    addedAt,
    search: `${title} ${artist ?? ''} ${album ?? ''}`.toLowerCase(),
  };
}

type View = { kind: 'tracks' } | { kind: 'playlists' } | { kind: 'playlist'; id: string; auto: boolean };

type PendingDelete =
  | { kind: 'track'; track: LibTrack }
  | { kind: 'playlist'; id: string; name: string }
  | { kind: 'zip'; id: string; name: string };

export default function MusicLibrary() {
  const [tracks, setTracks] = useState<LibTrack[]>([]);
  const [zips, setZips] = useState<StoredMusicZip[]>([]);
  const [manual, setManual] = useState<MusicPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'tracks' });
  const [pickForTrack, setPickForTrack] = useState<LibTrack | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState<{ onCreated?: (p: MusicPlaylist) => void } | null>(null);
  const [addToPlaylistId, setAddToPlaylistId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const { current, isPlaying, playMusic, removeTrack: removeTrackFromPlayer } = usePlayer();
  const artworkUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    (async () => {
      await rebuildAll();
      const pls = await loadMusicPlaylists();
      if (pls) setManual(pls);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onStorageChange = () => rebuildAll();
    window.addEventListener('aurora-storage-changed', onStorageChange);
    return () => window.removeEventListener('aurora-storage-changed', onStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rebuildAll() {
    setLoading(true);
    // Revoke previous artwork object URLs to release memory.
    for (const url of artworkUrlsRef.current) URL.revokeObjectURL(url);
    artworkUrlsRef.current = [];

    const dir = await loadDirHandle();
    const handles = await loadFileHandles();
    const zipList = await loadMusicZips();
    setZips(zipList);

    const all: LibTrack[] = [];
    if (dir) {
      const ts = await collectFromDir(dir);
      if (ts === null) {
        await clearDirHandle();
      } else {
        all.push(...ts);
      }
    }
    if (handles?.length) all.push(...(await collectFromHandles(handles)));
    for (const z of zipList) all.push(...(await collectFromZip(z)));

    const hidden = new Set(await loadHiddenMusicTracks());
    const next = all.filter((track) => !hidden.has(track.id));
    artworkUrlsRef.current = next.map((t) => t.artwork).filter((u): u is string => !!u);
    setTracks(next);
    setLoading(false);
  }

  useEffect(() => {
    return () => {
      for (const url of artworkUrlsRef.current) URL.revokeObjectURL(url);
      artworkUrlsRef.current = [];
    };
  }, []);

  async function collectFromDir(dir: FileSystemDirectoryHandle): Promise<LibTrack[] | null> {
    if (!(await ensurePermission(dir, 'read'))) return null;
    const out: LibTrack[] = [];
    for await (const { handle, path } of walkAudio(dir)) {
      const slash = path.indexOf('/');
      const topFolder = slash >= 0 ? path.slice(0, slash) : null;
      const id = `dir:${path}`;
      const fh = handle;
      const file = await fh.getFile();
      const t = await metaFromFile(
        file,
        id,
        topFolder,
        file.lastModified || Date.now(),
        async () => {
          await ensurePermission(dir, 'read');
          return URL.createObjectURL(await fh.getFile());
        },
      );
      out.push(t);
    }
    return out;
  }

  async function collectFromHandles(handles: FileSystemFileHandle[]): Promise<LibTrack[]> {
    const out: LibTrack[] = [];
    for (const fh of handles) {
      if (!(await ensurePermission(fh, 'read'))) continue;
      const file = await fh.getFile();
      if (!isAudioFilename(file.name)) continue;
      const id = `fh:${file.name}`;
      const t = await metaFromFile(file, id, null, file.lastModified || Date.now(), async () => {
        await ensurePermission(fh, 'read');
        return URL.createObjectURL(await fh.getFile());
      });
      out.push(t);
    }
    return out;
  }

  async function collectFromZip(stored: StoredMusicZip): Promise<LibTrack[]> {
    try {
      const zip = await JSZip.loadAsync(stored.blob);
      const entries = Object.values(zip.files)
        .filter(
          (e) =>
            !e.dir &&
            !isMacOsMetadataPath(e.name) &&
            isAudioFilename(basename(e.name)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const archiveName = stored.fileName.replace(/\.zip$/i, '');
      const out: LibTrack[] = [];
      for (const entry of entries) {
        const blob = await entry.async('blob');
        const baseName = basename(entry.name);
        const file = new File([blob], baseName, { type: blob.type });
        const id = `zip:${stored.id}::${entry.name}`;
        let cachedUrl: string | null = null;
        const resolveSrc = async () => {
          if (!cachedUrl) cachedUrl = URL.createObjectURL(blob);
          return cachedUrl;
        };
        const t = await metaFromFile(file, id, archiveName, stored.addedAt, resolveSrc);
        out.push(t);
      }
      return out;
    } catch {
      return [];
    }
  }

  async function pickFolder() {
    try {
      // @ts-ignore
      const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      await saveDirHandle(dir);
      await rebuildAll();
    } catch {
      /* canceled */
    }
  }

  async function pickFiles() {
    if (supportsFileSystemAccess()) {
      try {
        // @ts-ignore
        const handles: FileSystemFileHandle[] = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Audio',
              accept: { 'audio/*': ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.opus'] },
            },
          ],
        });
        const existing = (await loadFileHandles()) ?? [];
        const byName = new Map(existing.map((handle) => [handle.name, handle]));
        for (const handle of handles) byName.set(handle.name, handle);
        await saveFileHandles(Array.from(byName.values()));
        await rebuildAll();
        return;
      } catch {
        return;
      }
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*';
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      setLoading(true);
      const collected: LibTrack[] = [];
      for (const file of files) {
        if (!isAudioFilename(file.name)) continue;
        const url = URL.createObjectURL(file);
        const id = `file:${file.name}`;
        const t = await metaFromFile(file, id, null, file.lastModified || Date.now(), async () => url);
        collected.push(t);
      }
      setTracks((prev) => [...prev.filter((t) => !t.id.startsWith('file:')), ...collected]);
      setLoading(false);
    };
    input.click();
  }

  async function pickZip(file: File) {
    const entry: StoredMusicZip = {
      id: `zip-${Date.now()}`,
      fileName: file.name,
      blob: file,
      addedAt: Date.now(),
    };
    const next = [...zips, entry];
    await saveMusicZips(next);
    await rebuildAll();
  }

  async function confirmPending() {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    setPendingDelete(null);

    if (pd.kind === 'zip') {
      const next = zips.filter((z) => z.id !== pd.id);
      await saveMusicZips(next);
      await rebuildAll();
      return;
    }

    if (pd.kind === 'playlist') {
      const next = manual.filter((p) => p.id !== pd.id);
      setManual(next);
      await saveMusicPlaylists(next);
      return;
    }

    // pd.kind === 'track'
    const track = pd.track;
    if (track.id.startsWith('file:')) {
      setTracks((prev) => prev.filter((item) => item.id !== track.id));
    } else if (track.id.startsWith('fh:')) {
      const handles = (await loadFileHandles()) ?? [];
      await saveFileHandles(handles.filter((handle) => `fh:${handle.name}` !== track.id));
      await rebuildAll();
    } else {
      const hidden = await loadHiddenMusicTracks();
      await saveHiddenMusicTracks(Array.from(new Set([...hidden, track.id])));
      await rebuildAll();
    }
    const nextPlaylists = manual.map((playlist) => ({
      ...playlist,
      trackIds: playlist.trackIds.filter((id) => id !== track.id),
    }));
    setManual(nextPlaylists);
    await saveMusicPlaylists(nextPlaylists);
    removeTrackFromPlayer(track.id);
  }

  const zipNameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zips) m.set(z.fileName.replace(/\.zip$/i, ''), z.id);
    return m;
  }, [zips]);

  const autoPlaylists = useMemo(() => {
    const map = new Map<string, LibTrack[]>();
    for (const t of tracks) {
      if (!t.topFolder) continue;
      if (!map.has(t.topFolder)) map.set(t.topFolder, []);
      map.get(t.topFolder)!.push(t);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, ts]) => ({
        id: `auto:${name}`,
        name,
        tracks: ts,
        zipId: zipNameToId.get(name),
      }));
  }, [tracks, zipNameToId]);

  function sortTracks(list: LibTrack[]): LibTrack[] {
    const arr = [...list];
    switch (sort) {
      case 'recent':
        arr.sort((a, b) => b.addedAt - a.addedAt);
        break;
      case 'name-asc':
        arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
        break;
      case 'name-desc':
        arr.sort((a, b) => b.title.localeCompare(a.title, undefined, { numeric: true, sensitivity: 'base' }));
        break;
      case 'artist':
        arr.sort((a, b) => {
          const ar = (a.artist ?? '').localeCompare(b.artist ?? '', undefined, { sensitivity: 'base' });
          if (ar !== 0) return ar;
          return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        });
        break;
    }
    return arr;
  }

  const filteredTracks = useMemo(() => {
    const base = !query.trim() ? tracks : tracks.filter((t) => t.search.includes(query.toLowerCase()));
    return sortTracks(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, query, sort]);

  async function createPlaylistWithName(name: string): Promise<MusicPlaylist> {
    const p: MusicPlaylist = { id: `m:${Date.now()}`, name, trackIds: [] };
    const next = [...manual, p];
    setManual(next);
    await saveMusicPlaylists(next);
    return p;
  }

  async function addTracksToPlaylist(plId: string, trackIds: string[]) {
    const next = manual.map((p) => {
      if (p.id !== plId) return p;
      const set = new Set(p.trackIds);
      for (const id of trackIds) set.add(id);
      return { ...p, trackIds: Array.from(set) };
    });
    setManual(next);
    await saveMusicPlaylists(next);
  }

  async function removeTrackFromPlaylist(plId: string, trackId: string) {
    const next = manual.map((p) =>
      p.id === plId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p,
    );
    setManual(next);
    await saveMusicPlaylists(next);
  }

  function tracksOfManual(p: MusicPlaylist): LibTrack[] {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return p.trackIds.map((id) => byId.get(id)).filter((t): t is LibTrack => !!t);
  }

  // Drill-in view: playlist detail
  if (view.kind === 'playlist') {
    const pl = view.auto
      ? autoPlaylists.find((p) => p.id === view.id)
      : (() => {
          const m = manual.find((p) => p.id === view.id);
          return m ? { id: m.id, name: m.name, tracks: tracksOfManual(m) } : undefined;
        })();
    if (!pl) {
      setView({ kind: 'playlists' });
      return null;
    }
    const viewId = view.id;
    const isAuto = view.auto;
    return (
      <>
        <PlaylistDetail
          name={pl.name}
          tracks={pl.tracks}
          onBack={() => setView({ kind: 'playlists' })}
          onPlay={(t, list) => playMusic(t, list, list.indexOf(t))}
          currentId={current?.kind === 'music' ? current.track.id : undefined}
          isPlaying={isPlaying}
          onRemove={
            isAuto ? undefined : (trackId) => removeTrackFromPlaylist(viewId, trackId)
          }
          onAddTracks={isAuto ? undefined : () => setAddToPlaylistId(viewId)}
        />
        {addToPlaylistId === viewId && (
          <AddTracksModal
            allTracks={tracks}
            excludedIds={new Set(pl.tracks.map((t) => t.id))}
            onClose={() => setAddToPlaylistId(null)}
            onAdd={async (ids) => {
              await addTracksToPlaylist(viewId, ids);
              setAddToPlaylistId(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Моя музыка</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск..."
            className="glass-input text-sm rounded-full px-4 py-2 w-56"
          />
          {supportsFileSystemAccess() && (
            <button
              onClick={pickFolder}
              className="glass-button"
            >
              Добавить папку
            </button>
          )}
          <label className="glass-button cursor-pointer">
            Добавить ZIP
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickZip(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={pickFiles}
            className="primary-button"
          >
            Добавить файлы
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-6 border-b border-white/10 mb-6 flex-wrap">
        <div className="flex items-center gap-6">
          {(['tracks', 'playlists'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setView({ kind: k })}
              className={`pb-2 text-sm font-semibold transition-colors ${
                view.kind === k
                  ? 'text-white border-b-2 border-accent'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {k === 'tracks' ? 'Треки' : 'Плейлисты'}
            </button>
          ))}
        </div>
        {view.kind === 'tracks' && (
          <div className="flex items-center gap-2 pb-2">
            <SortDropdown sort={sort} onChange={setSort} />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        )}
      </div>

      {loading && <div className="text-neutral-400">Загрузка библиотеки…</div>}

      {!loading && tracks.length === 0 && (
        <div className="text-neutral-400 mt-12 text-center">
          Библиотека пуста. Добавьте папку или файлы, чтобы начать.
        </div>
      )}

      {view.kind === 'tracks' && tracks.length > 0 && (
        viewMode === 'grid' ? (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {filteredTracks.map((t) => {
              const active = current?.kind === 'music' && current.track.id === t.id;
              return (
                <div
                  key={t.id}
                  className="group relative glass-card p-3 rounded-xl"
                >
                  <button
                    onClick={() => playMusic(t, filteredTracks, filteredTracks.indexOf(t))}
                    className="w-full text-left"
                  >
                    <div className="aspect-square bg-white/[0.04] rounded-md overflow-hidden mb-3 flex items-center justify-center text-neutral-500 relative">
                      {t.artwork ? (
                        <img src={t.artwork} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                        </svg>
                      )}
                      {active && (
                        <div className="absolute bottom-2 right-2 bg-accent text-black rounded-full w-8 h-8 flex items-center justify-center">
                          <EqualizerAnimation playing={isPlaying} />
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold truncate">{t.title}</div>
                    <div className="text-xs text-neutral-400 truncate">{t.artist ?? t.album ?? ''}</div>
                  </button>
                  <button
                    onClick={() => setPickForTrack(t)}
                    className="track-action top-2 right-11"
                    aria-label="Добавить в плейлист"
                    title="Добавить в плейлист"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setPendingDelete({ kind: 'track', track: t })}
                    className="track-action top-2 right-2 hover:text-red-300"
                    aria-label="Удалить трек"
                    title="Убрать из библиотеки"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zM9 9v8h2V9H9zm4 0v8h2V9h-2zm1.5-5-1-1h-3l-1 1H6v2h12V4h-3.5z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <ul className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            {filteredTracks.map((t, i) => {
              const active = current?.kind === 'music' && current.track.id === t.id;
              return (
                <li
                  key={t.id}
                  className={`group flex items-center gap-3 px-4 py-2 transition-colors ${
                    active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-6 text-neutral-500 text-sm text-right shrink-0 tabular-nums">
                    {active ? <EqualizerAnimation playing={isPlaying} className="text-accent" /> : i + 1}
                  </div>
                  <button
                    onClick={() => playMusic(t, filteredTracks, filteredTracks.indexOf(t))}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded bg-white/5 overflow-hidden shrink-0 flex items-center justify-center text-neutral-500">
                      {t.artwork ? (
                        <img src={t.artwork} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm truncate ${active ? 'text-accent' : ''}`}>{t.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{t.artist ?? t.album ?? ''}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPickForTrack(t)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white text-sm px-2"
                    title="Добавить в плейлист"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setPendingDelete({ kind: 'track', track: t })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500 hover:text-red-400 text-sm px-2"
                    title="Убрать из библиотеки"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {view.kind === 'playlists' && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setCreatingPlaylist({})}
              className="glass-button"
            >
              + Создать плейлист
            </button>
          </div>
          {autoPlaylists.length + manual.length === 0 && (
            <div className="text-neutral-400 mt-8 text-center">
              Плейлисты появятся автоматически, если в выбранной папке есть подпапки.
              Или создайте свой вручную.
            </div>
          )}
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {autoPlaylists.map((p) => (
              <PlaylistCard
                key={p.id}
                name={p.name}
                count={p.tracks.length}
                badge={p.zipId ? 'ZIP' : 'Папка'}
                cover={p.tracks.find((t) => t.artwork)?.artwork}
                onOpen={() => setView({ kind: 'playlist', id: p.id, auto: true })}
                onDelete={
                  p.zipId
                    ? () =>
                        setPendingDelete({
                          kind: 'zip',
                          id: p.zipId!,
                          name: p.name,
                        })
                    : undefined
                }
              />
            ))}
            {manual.map((p) => {
              const ts = tracksOfManual(p);
              return (
                <PlaylistCard
                  key={p.id}
                  name={p.name}
                  count={ts.length}
                  badge="Свой"
                  cover={ts.find((t) => t.artwork)?.artwork}
                  onOpen={() => setView({ kind: 'playlist', id: p.id, auto: false })}
                  onDelete={() => setPendingDelete({ kind: 'playlist', id: p.id, name: p.name })}
                />
              );
            })}
          </div>
        </>
      )}

      {pickForTrack && (
        <AddToPlaylistModal
          track={pickForTrack}
          playlists={manual}
          onClose={() => setPickForTrack(null)}
          onPick={async (plId) => {
            await addTracksToPlaylist(plId, [pickForTrack.id]);
            setPickForTrack(null);
          }}
          onCreate={() => {
            const t = pickForTrack;
            setPickForTrack(null);
            setCreatingPlaylist({
              onCreated: (p) => addTracksToPlaylist(p.id, [t.id]),
            });
          }}
        />
      )}

      {creatingPlaylist && (
        <CreatePlaylistModal
          existingNames={manual.map((p) => p.name)}
          onClose={() => setCreatingPlaylist(null)}
          onCreate={async (name) => {
            const p = await createPlaylistWithName(name);
            creatingPlaylist.onCreated?.(p);
            setCreatingPlaylist(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete?.kind === 'track'
            ? 'Убрать трек из библиотеки?'
            : pendingDelete?.kind === 'playlist'
              ? 'Удалить плейлист?'
              : 'Удалить ZIP-плейлист?'
        }
        message={
          pendingDelete?.kind === 'track' ? (
            <>
              <span className="text-white font-semibold">«{pendingDelete.track.title}»</span>{' '}
              исчезнет из Aurora. Исходный файл на диске останется.
            </>
          ) : pendingDelete?.kind === 'playlist' ? (
            <>
              Удалить плейлист{' '}
              <span className="text-white font-semibold">«{pendingDelete.name}»</span>? Треки
              останутся в библиотеке.
            </>
          ) : pendingDelete?.kind === 'zip' ? (
            <>
              ZIP-архив{' '}
              <span className="text-white font-semibold">«{pendingDelete.name}»</span> и его треки
              исчезнут из библиотеки.
            </>
          ) : undefined
        }
        confirmLabel={pendingDelete?.kind === 'track' ? 'Убрать' : 'Удалить'}
        onConfirm={confirmPending}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function SortDropdown({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const labels: Record<SortKey, string> = {
    recent: 'Недавно добавленные',
    'name-asc': 'По имени (А-Я)',
    'name-desc': 'По имени (Я-А)',
    artist: 'По исполнителю',
  };
  return (
    <div className="relative">
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="glass-input rounded-full text-xs font-semibold pl-8 pr-8 py-1.5 cursor-pointer appearance-none text-white/85 hover:text-white"
      >
        {(Object.keys(labels) as SortKey[]).map((k) => (
          <option key={k} value={k} className="bg-neutral-900 text-white">
            {labels[k]}
          </option>
        ))}
      </select>
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/55 pointer-events-none"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
      </svg>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/55 pointer-events-none"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M7 10l5 5 5-5H7z" />
      </svg>
    </div>
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="glass rounded-full p-0.5 flex items-center gap-0.5">
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 rounded-full transition-colors ${
          mode === 'grid' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
        }`}
        title="Сеткой"
        aria-label="Сеткой"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 11h6V4H4v7zm0 9h6v-7H4v7zm9 0h6v-7h-6v7zm0-16v7h6V4h-6z" />
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 rounded-full transition-colors ${
          mode === 'list' ? 'bg-white text-black' : 'text-white/55 hover:text-white'
        }`}
        title="Списком"
        aria-label="Списком"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z" />
        </svg>
      </button>
    </div>
  );
}

function PlaylistCard({
  name,
  count,
  badge,
  cover,
  onOpen,
  onDelete,
}: {
  name: string;
  count: number;
  badge: string;
  cover?: string;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative glass-card p-3 rounded-xl">
      <button onClick={onOpen} className="w-full text-left">
        <div className="aspect-square bg-gradient-to-br from-white/10 to-white/[0.02] rounded-lg overflow-hidden mb-3 flex items-center justify-center text-neutral-400 relative">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
          )}
        </div>
        <div className="text-sm font-semibold truncate">{name}</div>
        <div className="text-xs text-neutral-400 truncate">
          {badge} · {count} {count === 1 ? 'трек' : 'треков'}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="track-action top-2 right-2 hover:text-red-300"
          aria-label="Удалить"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zM9 9v8h2V9H9zm4 0v8h2V9h-2zm1.5-5-1-1h-3l-1 1H6v2h12V4h-3.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function PlaylistDetail({
  name,
  tracks,
  onBack,
  onPlay,
  currentId,
  isPlaying,
  onRemove,
  onAddTracks,
}: {
  name: string;
  tracks: LibTrack[];
  onBack: () => void;
  onPlay: (t: LibTrack, list: LibTrack[]) => void;
  currentId?: string;
  isPlaying: boolean;
  onRemove?: (trackId: string) => void;
  onAddTracks?: () => void;
}) {
  const cover = tracks.find((t) => t.artwork)?.artwork;
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-end gap-6 mb-8">
        <button
          onClick={onBack}
          className="glass-button-icon self-start mt-1"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-xl shadow-black/50 shrink-0 bg-gradient-to-br from-white/15 to-white/[0.03] flex items-center justify-center text-neutral-400">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Плейлист</div>
          <h1 className="text-5xl font-extrabold truncate">{name}</h1>
          <div className="text-sm text-neutral-400 mt-3">
            {tracks.length} {tracks.length === 1 ? 'трек' : 'треков'}
          </div>
          <div className="flex items-center gap-2 mt-4">
            {tracks.length > 0 && (
              <button
                onClick={() => onPlay(tracks[0], tracks)}
                className="primary-button flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                Воспроизвести
              </button>
            )}
            {onAddTracks && (
              <button
                onClick={onAddTracks}
                className="glass-button"
              >
                + Добавить треки
              </button>
            )}
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-neutral-400 mt-8 text-center">
          Плейлист пуст. {onAddTracks && 'Нажмите «+ Добавить треки», чтобы наполнить его.'}
        </div>
      ) : (
        <ul className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {tracks.map((t, i) => {
            const active = currentId === t.id;
            return (
              <li
                key={t.id}
                className={`group flex items-center gap-3 px-4 py-2 transition-colors ${
                  active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-6 text-neutral-500 text-sm text-right shrink-0">
                  {active ? <EqualizerAnimation playing={isPlaying} className="text-accent" /> : i + 1}
                </div>
                <button onClick={() => onPlay(t, tracks)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 rounded bg-white/5 overflow-hidden shrink-0">
                    {t.artwork && <img src={t.artwork} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm truncate ${active ? 'text-accent' : ''}`}>{t.title}</div>
                    <div className="text-xs text-neutral-400 truncate">{t.artist ?? t.album ?? ''}</div>
                  </div>
                </button>
                {onRemove && (
                  <button
                    onClick={() => onRemove(t.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500 hover:text-red-400 text-sm px-2"
                    title="Удалить из плейлиста"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

function AddToPlaylistModal({
  track,
  playlists,
  onClose,
  onPick,
  onCreate,
}: {
  track: LibTrack;
  playlists: MusicPlaylist[];
  onClose: () => void;
  onPick: (plId: string) => void;
  onCreate: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="liquid-panel rounded-3xl p-5 max-h-[80vh] flex flex-col">
        <div className="text-sm text-neutral-300 mb-3 truncate">
          Добавить <span className="font-semibold text-white">«{track.title}»</span> в:
        </div>
        <button
          onClick={onCreate}
          className="text-left px-3 py-2 rounded-lg hover:bg-white/10 text-accent text-sm font-semibold transition-colors"
        >
          + Создать новый плейлист
        </button>
        <div className="overflow-y-auto mt-1">
          {playlists.length === 0 ? (
            <div className="text-neutral-500 text-sm px-3 py-2">Нет плейлистов.</div>
          ) : (
            playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className="block w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition-colors"
              >
                {p.name}
                <span className="text-neutral-500 ml-2">({p.trackIds.length})</span>
              </button>
            ))
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}

function CreatePlaylistModal({
  existingNames,
  onClose,
  onCreate,
}: {
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const duplicate = trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || duplicate) return;
    onCreate(trimmed);
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <form onSubmit={submit} className="liquid-panel rounded-3xl p-6">
        <h2 className="text-xl font-bold mb-1">Новый плейлист</h2>
        <div className="text-xs text-neutral-400 mb-4">Дайте плейлисту название</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Любимые"
          maxLength={60}
          className="w-full glass-input px-4 py-3 rounded-xl text-sm"
        />
        <div className="h-5 text-xs mt-1">
          {duplicate && <span className="text-red-400">Такое название уже есть</span>}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="glass-button"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!trimmed || duplicate}
            className="primary-button disabled:opacity-40"
          >
            Создать
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}

function AddTracksModal({
  allTracks,
  excludedIds,
  onClose,
  onAdd,
}: {
  allTracks: LibTrack[];
  excludedIds: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const available = useMemo(
    () => allTracks.filter((t) => !excludedIds.has(t.id)),
    [allTracks, excludedIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((t) => t.search.includes(q));
  }, [available, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-panel rounded-3xl p-5 w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Добавить треки в плейлист</h2>
          <span className="text-sm text-neutral-400">Выбрано: {picked.size}</span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по библиотеке..."
          className="w-full glass-input px-4 py-2 rounded-xl text-sm mb-3"
        />
        <div className="flex-1 overflow-y-auto min-h-0 -mx-2">
          {available.length === 0 ? (
            <div className="text-neutral-500 text-sm py-12 text-center">
              Все треки библиотеки уже в этом плейлисте.
            </div>
          ) : (
            filtered.map((t) => {
              const checked = picked.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    checked ? 'bg-accent/10' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      checked
                        ? 'bg-accent border-accent text-black'
                        : 'border-white/30 bg-transparent'
                    }`}
                  >
                    {checked && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded bg-white/5 overflow-hidden shrink-0">
                    {t.artwork && <img src={t.artwork} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{t.title}</div>
                    <div className="text-xs text-neutral-400 truncate">{t.artist ?? t.album ?? ''}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="glass-button"
          >
            Отмена
          </button>
          <button
            onClick={() => onAdd(Array.from(picked))}
            disabled={picked.size === 0}
            className="primary-button disabled:opacity-40"
          >
            Добавить {picked.size > 0 && `(${picked.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
