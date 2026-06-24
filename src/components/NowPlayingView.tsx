import { usePlayer } from '../store/playerStore';
import EqualizerAnimation from './EqualizerAnimation';

function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingView({ onClose }: { onClose: () => void }) {
  const {
    current,
    isPlaying,
    volume,
    progress,
    duration,
    shuffle,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
  } = usePlayer();

  if (!current) return null;

  const isRadio = current.kind === 'radio';
  const title = isRadio ? current.station.name : current.track.title;
  const subtitle = isRadio ? 'Прямой эфир' : current.track.artist ?? current.track.album ?? '';
  const artwork = isRadio ? current.station.iconUrl : current.track.artwork;

  return (
    <div className="fixed inset-0 z-50 text-white overflow-hidden np-anim">
      {/* Blurred artwork background */}
      <div className="absolute inset-0 -z-10">
        {artwork ? (
          <img
            src={artwork}
            alt=""
            className="w-full h-full object-cover scale-150"
            style={{ filter: 'blur(80px) saturate(1.4)' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-neutral-900 to-indigo-900" />
        )}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 glass hover:bg-white/15 w-10 h-10 rounded-full flex items-center justify-center transition-all"
        aria-label="Свернуть"
        title="Свернуть"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      <div className="h-full w-full flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Large artwork */}
          <div
            className={`w-72 h-72 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl shadow-black/70 bg-white/5 transition-transform duration-300 ${
              isPlaying ? 'scale-100' : 'scale-95'
            }`}
          >
            {artwork ? (
              <img src={artwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                  {isRadio ? (
                    <path d="M3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.33-.75-1.86L3.24 6.15zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h2v2z" />
                  ) : (
                    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                  )}
                </svg>
              </div>
            )}
          </div>

          {/* Title + artist */}
          <div className="mt-8 w-full text-center min-w-0">
            <div className="text-2xl sm:text-3xl font-bold truncate flex items-center justify-center gap-3">
              {title}
              <EqualizerAnimation playing={isPlaying} className="text-accent" />
            </div>
            <div className="text-base text-white/60 mt-1 truncate">{subtitle}</div>
          </div>

          {/* Scrubber */}
          <div className="w-full mt-8">
            <input
              type="range"
              min={0}
              max={isRadio ? 0 : Math.max(0, duration)}
              value={isRadio ? 0 : progress}
              step={0.1}
              onChange={(e) => seek(parseFloat(e.target.value))}
              disabled={isRadio}
              className="w-full"
              style={
                {
                  '--val': `${isRadio || !duration ? 0 : (progress / duration) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="flex justify-between text-xs text-white/50 mt-1 tabular-nums">
              <span>{isRadio ? 'LIVE' : fmt(progress)}</span>
              <span>{isRadio ? '' : fmt(duration)}</span>
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center justify-center gap-8 mt-6">
            <button
              onClick={toggleShuffle}
              className={`transition-colors ${shuffle ? 'text-accent' : 'text-white/60 hover:text-white'}`}
              aria-label="Перемешать"
              title="Перемешать"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.59 9.17 6.12 4.7 4.7 6.12l4.47 4.47 1.42-1.42zM14.5 4l2.04 2.04L4.71 17.88l1.42 1.42L17.96 7.46 20 9.5V4h-5.5zm.33 9.42-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.12z" />
              </svg>
            </button>
            <button
              onClick={prev}
              disabled={isRadio}
              className="text-white/80 hover:text-white disabled:text-white/30 transition-colors"
              aria-label="Назад"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-2xl shadow-black/40"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
              )}
            </button>
            <button
              onClick={next}
              disabled={isRadio}
              className="text-white/80 hover:text-white disabled:text-white/30 transition-colors"
              aria-label="Вперёд"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2V6zM6 6v12l8.5-6L6 6z" />
              </svg>
            </button>
            <div className="w-[22px]" />{/* spacer to balance shuffle */}
          </div>

          {/* Volume */}
          <div className="w-full flex items-center gap-3 mt-8 px-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1"
              style={{ '--val': `${volume * 100}%` } as React.CSSProperties}
            />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white/60">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 21 12 9 9 0 0 0 14 3.23z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
