import { useEffect, useState } from 'react';
import { usePlayer } from '../../../store/playerStore';
import { loadStations, saveStations, type Station } from '../../../lib/indexedDb';
import EqualizerAnimation from '../../EqualizerAnimation';

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
    const res = await fetch('/radio.json');
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

export default function Radio() {
  const [stations, setStations] = useState<Station[]>([]);
  const [modal, setModal] = useState(false);
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

  async function addStation(s: Omit<Station, 'id'>) {
    const next = [...stations, { ...s, id: `s-${Date.now()}` }];
    setStations(next);
    await saveStations(next);
  }

  async function removeStation(id: string) {
    const next = stations.filter((s) => s.id !== id);
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
        {stations.map((s) => {
          const active = current?.kind === 'radio' && current.station.id === s.id;
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
                  {s.iconUrl ? (
                    <img src={s.iconUrl} alt="" className="w-full h-full object-cover" />
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
                onClick={() => removeStation(s.id)}
                className="track-action top-2 right-2 hover:text-red-300"
                aria-label="Удалить"
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
  const [name, setName] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('Введите название');
    if (!isValidUrl(streamUrl)) return setErr('Некорректный URL потока');
    if (iconUrl && !isValidUrl(iconUrl)) return setErr('Некорректный URL иконки');
    onAdd({ name: name.trim(), streamUrl: streamUrl.trim(), iconUrl: iconUrl.trim() || undefined });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="liquid-panel rounded-3xl p-6 w-96 max-w-[90vw]"
      >
        <h2 className="text-xl font-bold mb-4">Новая радиостанция</h2>
        <Field label="Название">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full px-3 py-2 rounded-xl"
          />
        </Field>
        <Field label="URL потока (aacp/AAC+/mp3)">
          <input
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="https://..."
            className="glass-input w-full px-3 py-2 rounded-xl"
          />
        </Field>
        <Field label="Иконка (необязательно)">
          <input
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://..."
            className="glass-input w-full px-3 py-2 rounded-xl"
          />
        </Field>
        {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm hover:text-white text-neutral-300"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="primary-button"
          >
            Добавить
          </button>
        </div>
      </form>
    </div>
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
