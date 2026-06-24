import { useEffect, useMemo, useRef, useState } from 'react';
import {
  loadVideos,
  saveVideos,
  type StoredVideo,
} from '../../../lib/indexedDb';
import {
  ensurePermission,
  isVideoFilename,
  supportsFileSystemAccess,
} from '../../../lib/fileSystem';
import ConfirmDialog from '../../ConfirmDialog';
import VideoPlayer, { type VideoPlayerHandle } from '../IPTV/VideoPlayer';

type ResolvedVideo = {
  stored: StoredVideo;
  posterUrl?: string;
};

export default function Videos() {
  const [stored, setStored] = useState<StoredVideo[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StoredVideo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoredVideo | null>(null);

  useEffect(() => {
    (async () => {
      setStored(await loadVideos());
    })();
  }, []);

  useEffect(() => {
    const onStorageChange = async () => setStored(await loadVideos());
    window.addEventListener('aurora-storage-changed', onStorageChange);
    return () => window.removeEventListener('aurora-storage-changed', onStorageChange);
  }, []);

  // Build poster URLs from stored blobs (revoked on change/unmount).
  const display = useMemo<ResolvedVideo[]>(() => {
    return stored.map((s) => ({
      stored: s,
      posterUrl: s.posterBlob ? URL.createObjectURL(s.posterBlob) : undefined,
    }));
  }, [stored]);

  useEffect(() => {
    return () => {
      display.forEach((d) => {
        if (d.posterUrl) URL.revokeObjectURL(d.posterUrl);
      });
    };
  }, [display]);

  async function persist(next: StoredVideo[]) {
    setStored(next);
    await saveVideos(next);
  }

  async function addFiles() {
    if (supportsFileSystemAccess()) {
      try {
        // @ts-ignore
        const handles: FileSystemFileHandle[] = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Видео',
              accept: { 'video/*': ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi', '.ogv'] },
            },
          ],
        });
        const added: StoredVideo[] = [];
        for (const handle of handles) {
          const file = await handle.getFile();
          if (!isVideoFilename(file.name)) continue;
          added.push({
            id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'handle',
            title: file.name.replace(/\.[^.]+$/, ''),
            fileName: file.name,
            handle,
            addedAt: Date.now(),
          });
        }
        if (added.length) await persist([...stored, ...added]);
      } catch {
        /* canceled */
      } finally {
        setAdding(false);
      }
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*';
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      const added: StoredVideo[] = files
        .filter((f) => isVideoFilename(f.name))
        .map((f) => ({
          id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'blob' as const,
          title: f.name.replace(/\.[^.]+$/, ''),
          fileName: f.name,
          blob: f,
          addedAt: Date.now(),
        }));
      if (added.length) await persist([...stored, ...added]);
      setAdding(false);
    };
    input.click();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await persist(stored.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
  }

  async function saveEdit(updates: { title: string; posterBlob?: Blob | null }) {
    if (!editing) return;
    const id = editing.id;
    const next = stored.map((s) => {
      if (s.id !== id) return s;
      const patched = { ...s, title: updates.title } as StoredVideo;
      if (updates.posterBlob === null) delete (patched as any).posterBlob;
      else if (updates.posterBlob) (patched as any).posterBlob = updates.posterBlob;
      return patched;
    });
    setEditing(null);
    await persist(next);
  }

  const openVideo = display.find((v) => v.stored.id === openId);
  if (openVideo) {
    return (
      <VideoPlayback
        video={openVideo}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="page-shell overflow-y-auto h-full">
      <div className="page-header flex-wrap">
        <div>
          <div className="eyebrow">Локальные файлы</div>
          <h1 className="page-title">Видео</h1>
          <p className="page-subtitle">
            Ваша личная видеотека. Файлы остаются на диске — Aurora запоминает только ссылки.
          </p>
        </div>
        <button
          onClick={addFiles}
          className="primary-button flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Добавить видео
        </button>
      </div>

      {display.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center mt-8 max-w-2xl mx-auto">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center shadow-lg shadow-accent/30">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#0b0b0c">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Видеотека пуста</h2>
          <p className="text-white/60 mb-6 text-sm">
            Добавьте локальные видеофайлы — MP4, WebM, MKV, MOV и другие. Плеер тот же, что
            используется в ТВ.
          </p>
          <button onClick={addFiles} className="primary-button">
            Добавить первое видео
          </button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {display.map((v) => (
          <div key={v.stored.id} className="group relative glass-card p-3 rounded-2xl">
            <button
              onClick={() => setOpenId(v.stored.id)}
              className="w-full text-left"
            >
              <div className="aspect-video bg-white/[0.04] rounded-xl mb-3 flex items-center justify-center overflow-hidden text-white/40 relative">
                {v.posterUrl ? (
                  <img src={v.posterUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="text-sm font-semibold truncate">{v.stored.title}</div>
              <div className="text-xs text-white/40 truncate">{v.stored.fileName}</div>
            </button>
            <button
              onClick={() => setEditing(v.stored)}
              className="track-action top-2 right-11"
              aria-label="Изменить"
              title="Изменить"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
            <button
              onClick={() => setPendingDelete(v.stored)}
              className="track-action top-2 right-2 hover:text-red-300"
              aria-label="Удалить"
              title="Удалить"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zM9 9v8h2V9H9zm4 0v8h2V9h-2zm1.5-5-1-1h-3l-1 1H6v2h12V4h-3.5z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <EditVideoModal
          stored={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Удалить видео?"
        message={
          pendingDelete && (
            <>
              <span className="text-white font-semibold">«{pendingDelete.title}»</span>{' '}
              исчезнет из библиотеки. Файл на диске останется.
            </>
          )
        }
        confirmLabel="Удалить"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      {adding && null}
    </div>
  );
}

function VideoPlayback({
  video,
  onBack,
}: {
  video: ResolvedVideo;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const playerRef = useRef<VideoPlayerHandle>(null);

  useEffect(() => {
    let active = true;
    let revokable: string | null = null;
    (async () => {
      try {
        if (video.stored.kind === 'handle') {
          const ok = await ensurePermission(video.stored.handle, 'read');
          if (!ok) {
            if (active) setErr('Нет доступа к файлу');
            return;
          }
          const file = await video.stored.handle.getFile();
          revokable = URL.createObjectURL(file);
        } else {
          revokable = URL.createObjectURL(video.stored.blob);
        }
        if (active) setUrl(revokable);
        else if (revokable) URL.revokeObjectURL(revokable);
      } catch (e: any) {
        if (active) setErr(e?.message ?? 'Не удалось открыть файл');
      }
    })();
    return () => {
      active = false;
      if (revokable) URL.revokeObjectURL(revokable);
    };
  }, [video.stored]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' && e.key !== 'F' && e.key !== 'а' && e.key !== 'А') return;
      const t = e.target as HTMLElement;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      e.preventDefault();
      playerRef.current?.toggleFullscreen();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{video.stored.title}</div>
          <div className="text-xs text-white/40 truncate">{video.stored.fileName}</div>
        </div>
      </div>
      <div className="flex-1 p-6 min-w-0">
        {url ? (
          <VideoPlayer ref={playerRef} source={{ url, isLive: false }} />
        ) : (
          <div className="w-full h-full rounded-[32px] bg-black/60 flex items-center justify-center text-white/60">
            {err ?? 'Загрузка...'}
          </div>
        )}
      </div>
    </div>
  );
}

function EditVideoModal({
  stored,
  onClose,
  onSave,
}: {
  stored: StoredVideo;
  onClose: () => void;
  onSave: (updates: { title: string; posterBlob?: Blob | null }) => void;
}) {
  const [title, setTitle] = useState(stored.title);
  const [posterBlob, setPosterBlob] = useState<Blob | undefined>(stored.posterBlob);
  const [preview, setPreview] = useState<string | undefined>(() =>
    stored.posterBlob ? URL.createObjectURL(stored.posterBlob) : undefined,
  );
  const [changed, setChanged] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    return () => {
      if (preview && changed) URL.revokeObjectURL(preview);
    };
  }, [preview, changed]);

  function pick(file: File) {
    if (preview && changed) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(file);
    setPosterBlob(file);
    setPreview(url);
    setChanged(true);
    setCleared(false);
  }

  function clearPoster() {
    if (preview && changed) URL.revokeObjectURL(preview);
    setPosterBlob(undefined);
    setPreview(undefined);
    setChanged(false);
    setCleared(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title: title.trim() || stored.title,
      posterBlob: changed ? posterBlob : cleared ? null : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="liquid-panel rounded-3xl p-6 w-full max-w-md"
      >
        <h2 className="text-xl font-bold mb-4">Изменить видео</h2>
        <div className="flex gap-4 mb-4">
          <label className="w-32 h-20 rounded-xl overflow-hidden bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/40 cursor-pointer shrink-0 relative group">
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
              Постер
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
              }}
            />
          </label>
          <div className="flex-1">
            <label className="block">
              <div className="text-xs text-white/50 mb-1">Название</div>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-sm"
              />
            </label>
            {preview && (
              <button
                type="button"
                onClick={clearPoster}
                className="text-xs text-white/50 hover:text-red-300 mt-3"
              >
                Сбросить постер
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button">
            Отмена
          </button>
          <button type="submit" className="primary-button">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}
