import { useEffect, useState } from 'react';
import {
  clearAudiobookStorage,
  clearMusicStorage,
  clearPlayerStorage,
  loadStorageSnapshot,
  type StorageSnapshot,
} from '../../../lib/indexedDb';

function bytes(value: number) {
  if (!value) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

export default function Storage() {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null);

  async function refresh() {
    setSnapshot(await loadStorageSnapshot());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(action: () => Promise<void>, message: string) {
    if (!confirm(message)) return;
    await action();
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
            run(clearMusicStorage, 'Удалить музыку, ZIP, плейлисты и привязки к папкам из Aurora?')
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
            run(clearAudiobookStorage, 'Удалить все аудиокниги из библиотеки Aurora?')
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
          ]}
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
            run(clearPlayerStorage, 'Полностью очистить локальное хранилище Aurora?')
          }
        >
          Сбросить всё
        </button>
      </section>
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
