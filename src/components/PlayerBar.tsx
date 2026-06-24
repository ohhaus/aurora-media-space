import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../store/playerStore';
import EqualizerAnimation from './EqualizerAnimation';
import NowPlayingView from './NowPlayingView';

function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);
  const {
    current,
    isPlaying,
    volume,
    progress,
    duration,
    shuffle,
    repeat,
    bindAudio,
    setIsPlaying,
    setProgress,
    setDuration,
    setVolume,
    togglePlay,
    toggleShuffle,
    toggleRepeat,
    next,
    prev,
    seek,
  } = usePlayer();

  useEffect(() => {
    bindAudio(audioRef.current);
    return () => bindAudio(null);
  }, [bindAudio]);

  const hasCurrent = !!current;
  const isRadio = current?.kind === 'radio';
  const title = current
    ? current.kind === 'music'
      ? current.track.title
      : current.station.name
    : 'Ничего не играет';
  const subtitle = current
    ? current.kind === 'music'
      ? current.track.artist ?? current.track.album ?? ''
      : 'Радиостанция'
    : '';
  const artwork =
    current?.kind === 'music' ? current.track.artwork : current?.kind === 'radio' ? current.station.iconUrl : undefined;

  return (
    <>
      <div className="player-shell music-player-shell h-[82px] px-4 pt-2 flex items-center gap-4 shrink-0">
        {/* Hidden audio drives playback for music + radio */}
        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (current?.kind === 'music' && !repeat) next();
          }}
          onTimeUpdate={(e) => setProgress((e.currentTarget as HTMLAudioElement).currentTime)}
          onLoadedMetadata={(e) => setDuration((e.currentTarget as HTMLAudioElement).duration)}
        />

        <div className="music-progress-rail">
          <input
            type="range"
            min={0}
            max={isRadio ? 1 : Math.max(0, duration)}
            value={isRadio ? 1 : progress}
            step={0.1}
            onChange={(e) => seek(parseFloat(e.target.value))}
            disabled={isRadio || !current}
            aria-label="Позиция трека"
            style={
              {
                '--val': `${isRadio ? 100 : !duration ? 0 : (progress / duration) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span className="music-time-badge music-time-start">
            {isRadio ? 'LIVE' : fmt(progress)}
          </span>
          <span className="music-time-badge music-time-end">
            {isRadio ? 'ЭФИР' : fmt(duration)}
          </span>
        </div>

        {/* Left: artwork + meta — clickable to expand */}
        <button
          onClick={() => hasCurrent && setExpanded(true)}
          disabled={!hasCurrent}
          className="group flex items-center gap-3 w-60 min-w-0 text-left disabled:cursor-default"
          title={hasCurrent ? 'Открыть' : ''}
        >
          <div
            className={`relative w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400 overflow-hidden shrink-0 shadow-lg shadow-black/40 transition-transform duration-300 ${
              isPlaying && hasCurrent ? 'scale-100' : 'scale-95'
            }`}
          >
            {artwork ? (
              <img src={artwork} className="w-full h-full object-cover" alt="" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              </svg>
            )}
            {hasCurrent && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white truncate flex items-center gap-2">
              {title}
              {current && <EqualizerAnimation playing={isPlaying} className="text-accent" />}
            </div>
            <div className="text-xs text-neutral-400 truncate">{subtitle}</div>
          </div>
        </button>

        {/* Center: separated controls */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0 mx-auto">
            <button
              onClick={toggleShuffle}
              className={`music-control-button ${shuffle ? 'music-control-active' : ''}`}
              aria-label="Перемешать"
              title="Перемешать"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.59 9.17 6.12 4.7 4.7 6.12l4.47 4.47 1.42-1.42zM14.5 4l2.04 2.04L4.71 17.88l1.42 1.42L17.96 7.46 20 9.5V4h-5.5zm.33 9.42-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.12z" />
              </svg>
            </button>
            <button
              onClick={prev}
              disabled={!current || isRadio}
              className="music-control-button"
              aria-label="Назад"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              disabled={!current}
              className="music-play-button"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
              )}
            </button>
            <button
              onClick={next}
              disabled={!current || isRadio}
              className="music-control-button"
              aria-label="Вперёд"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2V6zM6 6v12l8.5-6L6 6z" />
              </svg>
            </button>
            <button
              onClick={toggleRepeat}
              disabled={!current || isRadio}
              className={`music-control-button ${repeat ? 'music-control-active' : ''}`}
              aria-label="Повторять трек"
              title="Повторять трек"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H7a5 5 0 0 0-5 5v2h2v-2a3 3 0 0 1 3-3zm10 10H7v-3l-4 4 4 4v-3h10a5 5 0 0 0 5-5v-2h-2v2a3 3 0 0 1-3 3z" />
              </svg>
              {repeat && <span className="repeat-one">1</span>}
            </button>
        </div>

        {/* Right: volume */}
        <div className="music-volume w-36 flex items-center gap-2 text-neutral-400 liquid-volume px-3 py-2">
          <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 8.05v7.9A4.5 4.5 0 0 0 16.5 12z" />
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
        </div>
      </div>

      {expanded && <NowPlayingView onClose={() => setExpanded(false)} />}
    </>
  );
}
