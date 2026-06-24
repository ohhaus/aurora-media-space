import { useEffect, useState } from 'react';
import {
  clearAudiobookStorage,
  clearMusicStorage,
  clearPlayerStorage,
  clearVideoStorage,
  loadStorageSnapshot,
  type StorageSnapshot,
} from '../../../lib/indexedDb';
import ConfirmDialog from '../../ConfirmDialog';

function bytes(value: number) {
  if (!value) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

type Pending = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  action: () => Promise<void>;
};

export default function Storage() {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  async function refresh() {
    setSnapshot(await loadStorageSnapshot());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function runPending() {
    if (!pending) return;
    const fn = pending.action;
    setPending(null);
    await fn();
    await refresh();
    window.dispatchEvent(new Event('aurora-storage-changed'));
  }

  if (!snapshot) return <div className="page-shell text-white/50">Считаем данные…</div>;

  return (
    <div className="page-shell overflow-y-auto h-full">
      <header className="page-header">
        <div>
          <div className="eyebrow">Локально и приватно</div>
          <h1 className="page-title">Хранилище</h1>
          <p className="page-subtitle">
            Aurora хранит настройки и архивы только в этом браузере. Папки остаются на диске —
            приложение запоминает лишь разрешение на чтение.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <StorageCard
          title="Музыка"
          accent="violet"
          value={`${snapshot.musicFiles + snapshot.musicZips} источников`}
          details={[
            `${snapshot.musicFiles} отдельных файлов`,
            `${snapshot.musicZips} ZIP · ${bytes(snapshot.musicZipBytes)}`,
            snapshot.musicFolderConnected ? 'Папка подключена' : 'Папка не подключена',
            `${snapshot.hiddenTracks} скрытых треков`,
          ]}
          action="Очистить музыку"
          onAction={() =>
            setPending({
              title: 'Очистить музыку?',
              message: 'Удалит ZIP-архивы, плейлисты и привязки к папкам из Aurora. Исходные файлы на диске останутся.',
              confirmLabel: 'Очистить',
              action: clearMusicStorage,
            })
          }
        />
        <StorageCard
          title="Аудиокниги"
          accent="cyan"
          value={`${snapshot.audiobooks} книг`}
          details={[
            `${bytes(snapshot.audiobookBytes)} в ZIP-архивах`,
            'Папки на диске не изменяются',
          ]}
          action="Очистить книги"
          onAction={() =>
            setPending({
              title: 'Удалить все аудиокниги?',
              message: 'Все книги исчезнут из библиотеки Aurora. Исходные файлы останутся на компьютере.',
              confirmLabel: 'Удалить',
              action: clearAudiobookStorage,
            })
          }
        />
        <StorageCard
          title="Эфир"
          accent="orange"
          value={`${snapshot.channels} каналов`}
          details={[
            `${snapshot.iptvPlaylists} IPTV-плейлистов`,
            `${snapshot.stations} радиостанций`,
            `${snapshot.musicPlaylists} музыкальных плейлистов`,
            `${snapshot.videos} видео`,
          ]}
          action="Очистить видео"
          onAction={() =>
            setPending({
              title: 'Удалить все видео?',
              message: 'Удалит сохранённые видео из библиотеки Aurora. Исходные файлы останутся на компьютере.',
              confirmLabel: 'Удалить',
              action: clearVideoStorage,
            })
          }
        />
      </div>

      <section className="liquid-panel mt-5 p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Полный сброс Aurora</h2>
          <p className="text-sm text-white/50 mt-1 max-w-2xl">
            Удалит все локальные записи приложения: медиатеку, станции, IPTV и настройки.
            Исходные файлы на компьютере останутся нетронутыми.
          </p>
        </div>
        <button
          className="danger-button shrink-0"
          onClick={() =>
            setPending({
              title: 'Полный сброс Aurora?',
              message: 'Удалит все локальные настройки и данные приложения. Это действие нельзя отменить.',
              confirmLabel: 'Сбросить всё',
              action: clearPlayerStorage,
            })
          }
        >
          Сбросить всё
        </button>
      </section>

      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ''}
        message={pending?.message}
        confirmLabel={pending?.confirmLabel ?? 'Удалить'}
        onConfirm={runPending}
        onClose={() => setPending(null)}
      />
    </div>
  );
}

function StorageCard({
  title,
  value,
  details,
  accent,
  action,
  onAction,
}: {
  title: string;
  value: string;
  details: string[];
  accent: 'violet' | 'cyan' | 'orange';
  action?: string;
  onAction?: () => void;
}) {
  return (
    <article className={`storage-card storage-${accent}`}>
      <div className="storage-orb" />
      <div className="relative">
        <div className="text-sm text-white/50">{title}</div>
        <div className="text-3xl font-semibold tracking-tight mt-2">{value}</div>
        <ul className="mt-5 space-y-2 text-sm text-white/60">
          {details.map((detail) => (
            <li key={detail} className="flex gap-2">
              <span className="text-white/30">•</span>
              {detail}
            </li>
          ))}
        </ul>
        {action && (
          <button className="glass-button mt-6" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
    </article>
  );
}
