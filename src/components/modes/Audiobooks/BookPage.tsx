import { useMemo } from 'react';
import { usePlayer } from '../../../store/playerStore';
import EqualizerAnimation from '../../EqualizerAnimation';
import type { Book } from './lib';
import { chaptersToTracks } from './lib';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BookPage({ book, onBack }: { book: Book; onBack: () => void }) {
  const {
    current,
    isPlaying,
    progress,
    duration,
    playbackRate,
    playMusic,
    togglePlay,
    seek,
    setPlaybackRate,
  } = usePlayer();

  const tracks = useMemo(() => chaptersToTracks(book), [book]);
  const currentChapterIdx = useMemo(() => {
    if (current?.kind !== 'music') return -1;
    return book.chapters.findIndex((c) => c.id === current.track.id);
  }, [current, book.chapters]);
  const isCurrentBook = currentChapterIdx >= 0;

  function playChapter(i: number) {
    if (i < 0 || i >= book.chapters.length) return;
    playMusic(tracks[i], tracks, i);
  }

  function skip(deltaSec: number) {
    if (!isCurrentBook) return;
    seek(Math.max(0, Math.min(duration || 0, progress + deltaSec)));
  }

  const playingChapterTitle =
    isCurrentBook && current?.kind === 'music' ? current.track.title : book.chapters[0]?.title ?? '';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0 glass-strong">
        <button
          onClick={onBack}
          className="glass hover:bg-white/10 transition-all w-10 h-10 rounded-full flex items-center justify-center"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Аудиокнига</div>
          <div className="font-semibold truncate">{book.title}</div>
        </div>
      </div>

      {/* Body: cover/info left, chapters right */}
      <div className="flex-1 flex min-h-0">
        <div className="w-[360px] shrink-0 p-8 flex flex-col items-center text-center border-r border-white/5">
          <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-gradient-to-br from-white/15 to-white/[0.03]">
            {book.cover ? (
              <img src={book.cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400">
                <svg width="96" height="96" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h2v10l-1-.75L8 14V4zm10 16H6v-1h12v1zm0-3H6V4h2v14l3-2.25L14 18V4h4v13z" />
                </svg>
              </div>
            )}
            {isCurrentBook && isPlaying && (
              <div className="absolute inset-0 ring-2 ring-accent/50 ring-offset-2 ring-offset-transparent rounded-2xl pointer-events-none animate-pulse" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold mt-5 line-clamp-3">{book.title}</h1>
          <div className="text-sm text-neutral-400 mt-1">{book.chapters.length} глав</div>
          <button
            onClick={() => playChapter(isCurrentBook ? currentChapterIdx : 0)}
            className="mt-5 bg-accent hover:bg-accentHover text-black text-sm font-semibold px-6 py-2.5 rounded-full flex items-center gap-2 shadow-lg shadow-accent/30 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
            {isCurrentBook ? 'Продолжить' : 'Начать слушать'}
          </button>
        </div>

        {/* Chapters list */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xs uppercase tracking-wider text-neutral-400 mb-3">Главы</h2>
          <ul className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            {book.chapters.map((ch, i) => {
              const active = i === currentChapterIdx;
              return (
                <li
                  key={ch.id}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${
                    active ? 'bg-accent/10' : 'hover:bg-white/[0.04]'
                  }`}
                  onClick={() => playChapter(i)}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                      active ? 'bg-accent text-black' : 'bg-white/5 text-neutral-300'
                    }`}
                  >
                    {active ? <EqualizerAnimation playing={isPlaying} /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${active ? 'text-accent font-semibold' : ''}`}>
                      {ch.title}
                    </div>
                    <div className="text-xs text-neutral-500">Глава {i + 1}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Bottom integrated player */}
      <div className="glass-strong border-t border-white/10 px-6 py-3 shrink-0">
        <div className="text-xs text-neutral-400 mb-1 flex items-center gap-2">
          <span>
            Глава {currentChapterIdx >= 0 ? currentChapterIdx + 1 : '—'} / {book.chapters.length}
          </span>
          <span className="text-white truncate">— {playingChapterTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 w-10 text-right tabular-nums">
            {fmt(progress)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, duration)}
            value={progress}
            step={0.1}
            onChange={(e) => seek(parseFloat(e.target.value))}
            disabled={!isCurrentBook}
            className="flex-1"
            style={
              {
                '--val': `${!duration ? 0 : (progress / duration) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span className="text-[11px] text-neutral-400 w-10 tabular-nums">{fmt(duration)}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => skip(-30)}
              disabled={!isCurrentBook}
              className="glass hover:bg-white/10 disabled:opacity-40 transition-all w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
              title="-30 секунд"
            >
              -30
            </button>
            <button
              onClick={() => playChapter(currentChapterIdx - 1)}
              disabled={currentChapterIdx <= 0}
              className="text-neutral-300 hover:text-white disabled:text-neutral-600 transition-colors"
              aria-label="Предыдущая глава"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (!isCurrentBook) playChapter(0);
                else togglePlay();
              }}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying && isCurrentBook ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => playChapter(currentChapterIdx + 1)}
              disabled={currentChapterIdx < 0 || currentChapterIdx >= book.chapters.length - 1}
              className="text-neutral-300 hover:text-white disabled:text-neutral-600 transition-colors"
              aria-label="Следующая глава"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2V6zM6 6v12l8.5-6L6 6z" />
              </svg>
            </button>
            <button
              onClick={() => skip(30)}
              disabled={!isCurrentBook}
              className="glass hover:bg-white/10 disabled:opacity-40 transition-all w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
              title="+30 секунд"
            >
              +30
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1 glass rounded-full p-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackRate(s)}
                className={`text-xs font-semibold rounded-full transition-colors px-2.5 py-1 ${
                  Math.abs(playbackRate - s) < 0.001
                    ? 'bg-accent text-black'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
