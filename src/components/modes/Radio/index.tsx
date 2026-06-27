import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../../../store/playerStore';
import { loadStations, saveStations, type Station } from '../../../lib/indexedDb';
import EqualizerAnimation from '../../EqualizerAnimation';
import ConfirmDialog from '../../ConfirmDialog';

function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function seedFromBundled(): Promise<Station[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}radio.json`);
    const json = (await res.json()) as Record<string, string>;
    return Object.entries(json).map(([name, streamUrl], i) => ({
      id: `seed-${i}`,
      name,
      streamUrl,
    }));
  } catch {
    return [];
  }
}

type DisplayStation = Station & { previewIcon?: string };

export default function Radio() {
  const [stations, setStations] = useState<Station[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Station | null>(null);
  const { current, isPlaying, playRadio } = usePlayer();

  useEffect(() => {
    (async () => {
      const saved = await loadStations();
      if (saved && saved.length) {
        setStations(saved);
      } else {
        const seeded = await seedFromBundled();
        setStations(seeded);
        if (seeded.length) await saveStations(seeded);
      }
    })();
  }, []);

  // Derive object URLs for stored icon blobs only when blobs change.
  const display: DisplayStation[] = useMemo(() => {
    const urls = new Map<string, string>();
    const list = stations.map((s) => {
      if (s.iconBlob) {
        const url = URL.createObjectURL(s.iconBlob);
        urls.set(s.id, url);
        return { ...s, previewIcon: url };
      }
      return s;
    });
    // Revoke later when stations change
    (list as any)._urls = urls;
    return list;
  }, [stations]);

  useEffect(() => {
    return () => {
      const urls: Map<string, string> | undefined = (display as any)._urls;
      urls?.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [display]);

  async function addStation(s: Omit<Station, 'id'>) {
    const next = [...stations, { ...s, id: `s-${Date.now()}` }];
    setStations(next);
    await saveStations(next);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const next = stations.filter((s) => s.id !== id);
    setStations(next);
    await saveStations(next);
  }

  async function saveEdit(updated: Station) {
    setEditing(null);
    const next = stations.map((s) => (s.id === updated.id ? updated : s));
    setStations(next);
    await saveStations(next);
  }

  return (
    <div className="page-shell overflow-y-auto h-full">
      <div className="page-header flex-wrap">
        <div>
          <div className="eyebrow">Прямой эфир</div>
          <h1 className="page-title">Радио</h1>
          <p className="page-subtitle">Ваши станции в едином локальном пространстве.</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="primary-button"
        >
          + Добавить радиостанцию
        </button>
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
        {display.map((s) => {
          const active = current?.kind === 'radio' && current.station.id === s.id;
          const icon = s.previewIcon ?? s.iconUrl;
          return (
            <div
              key={s.id}
              className={`group glass-card transition-all duration-200 p-3 rounded-2xl relative ${
                active ? 'radio-card-active' : ''
              }`}
            >
              <button
                onClick={() => playRadio(s)}
                className="w-full text-left"
              >
                <div className="radio-artwork aspect-square rounded-xl overflow-hidden mb-3 flex items-center justify-center text-neutral-400 relative">
                  {icon ? (
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.33-.75-1.86L3.24 6.15zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h2v2z" />
                    </svg>
                  )}
                  {active && (
                    <div className="absolute bottom-2 right-2 bg-white/90 text-black rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                      <EqualizerAnimation playing={isPlaying} />
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold truncate">{s.name}</div>
                <div className="text-xs text-white/40 truncate flex items-center gap-1.5">
                  <span className="live-dot" />
                  Прямой эфир
                </div>
              </button>
              <button
                onClick={() => setEditing(s)}
                className="track-action top-2 right-11"
                aria-label="Изменить"
                title="Изменить"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <button
                onClick={() => setPendingDelete(s)}
                className="track-action top-2 right-2 hover:text-red-300"
                aria-label="Удалить"
                title="Удалить"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zM9 9v8h2V9H9zm4 0v8h2V9h-2zm1.5-5-1-1h-3l-1 1H6v2h12V4h-3.5z" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {modal && <AddStationModal onClose={() => setModal(false)} onAdd={addStation} />}
      {editing && (
        <EditStationModal
          station={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Удалить станцию?"
        message={
          pendingDelete && (
            <>
              <span className="text-white font-semibold">«{pendingDelete.name}»</span>{' '}
              исчезнет из списка радиостанций.
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

function StationForm({
  initial,
  submitLabel,
  onSubmit,
  onClose,
  title,
}: {
  initial?: Station;
  submitLabel: string;
  onSubmit: (s: { name: string; streamUrl: string; iconUrl?: string; iconBlob?: Blob; clearBlob?: boolean }) => void;
  onClose: () => void;
  title: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [streamUrl, setStreamUrl] = useState(initial?.streamUrl ?? '');
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '');
  const [iconBlob, setIconBlob] = useState<Blob | undefined>(initial?.iconBlob);
  const [iconPreview, setIconPreview] = useState<string | undefined>(() =>
    initial?.iconBlob ? URL.createObjectURL(initial.iconBlob) : initial?.iconUrl,
  );
  const [iconChanged, setIconChanged] = useState(false);
  const [iconCleared, setIconCleared] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (iconPreview && iconBlob && iconChanged) URL.revokeObjectURL(iconPreview);
    };
  }, [iconPreview, iconBlob, iconChanged]);

  function pickFile(file: File) {
    if (iconPreview && iconBlob && iconChanged) URL.revokeObjectURL(iconPreview);
    const url = URL.createObjectURL(file);
    setIconBlob(file);
    setIconPreview(url);
    setIconUrl('');
    setIconChanged(true);
    setIconCleared(false);
  }

  function clearIcon() {
    if (iconPreview && iconBlob && iconChanged) URL.revokeObjectURL(iconPreview);
    setIconBlob(undefined);
    setIconPreview(undefined);
    setIconUrl('');
    setIconChanged(false);
    setIconCleared(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('Введите название');
    if (!isValidUrl(streamUrl)) return setErr('Некорректный URL потока');
    if (iconUrl && !iconBlob && !isValidUrl(iconUrl)) return setErr('Некорректный URL иконки');
    onSubmit({
      name: name.trim(),
      streamUrl: streamUrl.trim(),
      iconUrl: iconBlob ? undefined : iconUrl.trim() || undefined,
      iconBlob: iconChanged ? iconBlob : undefined,
      clearBlob: iconCleared,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="liquid-panel rounded-3xl p-6 w-[440px] max-w-[90vw]"
      >
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="flex gap-4 mb-4">
          <label className="w-24 h-24 rounded-2xl overflow-hidden radio-artwork flex items-center justify-center text-neutral-400 cursor-pointer shrink-0 relative group">
            {iconPreview ? (
              <img src={iconPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.33-.75-1.86L3.24 6.15zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h2v2z" />
              </svg>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
              Иконка
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
          </label>
          <div className="flex-1 min-w-0">
            <Field label="Название">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl"
              />
            </Field>
          </div>
        </div>
        <Field label="URL потока (aacp/AAC+/mp3)">
          <input
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="https://..."
            className="glass-input w-full px-3 py-2 rounded-xl"
          />
        </Field>
        {!iconBlob && (
          <Field label="Иконка по URL (необязательно)">
            <input
              value={iconUrl}
              onChange={(e) => {
                setIconUrl(e.target.value);
                setIconPreview(e.target.value || undefined);
                setIconChanged(false);
                setIconCleared(!e.target.value);
              }}
              placeholder="https://..."
              className="glass-input w-full px-3 py-2 rounded-xl"
            />
          </Field>
        )}
        {iconPreview && (
          <button
            type="button"
            onClick={clearIcon}
            className="text-xs text-white/50 hover:text-red-300 mb-3"
          >
            Сбросить иконку
          </button>
        )}
        {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="glass-button"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="primary-button"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddStationModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (s: Omit<Station, 'id'>) => void;
}) {
  return (
    <StationForm
      title="Новая радиостанция"
      submitLabel="Добавить"
      onClose={onClose}
      onSubmit={(s) => {
        onAdd({
          name: s.name,
          streamUrl: s.streamUrl,
          iconUrl: s.iconUrl,
          iconBlob: s.iconBlob,
        });
        onClose();
      }}
    />
  );
}

function EditStationModal({
  station,
  onClose,
  onSave,
}: {
  station: Station;
  onClose: () => void;
  onSave: (s: Station) => void;
}) {
  return (
    <StationForm
      title="Изменить станцию"
      submitLabel="Сохранить"
      initial={station}
      onClose={onClose}
      onSubmit={(s) => {
        const next: Station = {
          ...station,
          name: s.name,
          streamUrl: s.streamUrl,
        };
        if (s.iconBlob) {
          next.iconBlob = s.iconBlob;
          next.iconUrl = undefined;
        } else if (s.clearBlob) {
          next.iconBlob = undefined;
          next.iconUrl = s.iconUrl;
        } else {
          next.iconUrl = s.iconUrl ?? station.iconUrl;
        }
        onSave(next);
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
