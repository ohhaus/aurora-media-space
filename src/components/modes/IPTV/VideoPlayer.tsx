import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

export type VideoPlayerHandle = {
  toggleFullscreen: () => void;
};

export type VideoSource = {
  url: string;
  isLive?: boolean;
};

type Engine = 'hls' | 'mpegts' | 'native';
function pickEngine(url: string): Engine {
  const u = url.toLowerCase().split('?')[0];
  if (u.endsWith('.m3u8') || u.includes('.m3u8')) return 'hls';
  if (u.endsWith('.ts')) return 'mpegts';
  return 'native';
}

type Props = { source: VideoSource } | { channel: { url: string } };

/** Pure media player: just the <video> + engine wiring. No chrome. */
const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  props,
  ref,
) {
  const source: VideoSource =
    'source' in props ? props.source : { url: props.channel.url };
  const { url, isLive } = source;
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {
        // @ts-ignore Safari fallback
        videoRef.current?.webkitEnterFullscreen?.();
      });
    }
  }

  useImperativeHandle(ref, () => ({
    toggleFullscreen,
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setErr(null);
    const engine = pickEngine(url);

    let hls: Hls | null = null;
    let ts: ReturnType<typeof mpegts.createPlayer> | null = null;

    if (engine === 'hls') {
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setErr(`HLS: ${data.details}`);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      } else {
        setErr('HLS не поддерживается этим браузером');
      }
    } else if (engine === 'mpegts') {
      if (mpegts.getFeatureList().mseLivePlayback) {
        ts = mpegts.createPlayer({ type: 'mpegts', url, isLive: isLive ?? true });
        ts.attachMediaElement(video);
        ts.load();
        Promise.resolve(ts.play()).catch(() => {});
      } else {
        setErr('MPEG-TS не поддерживается этим браузером');
      }
    } else {
      video.src = url;
    }

    video.play().catch(() => {});

    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (hls) hls.destroy();
      if (ts) ts.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, isLive]);

  useEffect(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing && controlsVisible) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2600);
    }
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [playing, controlsVisible]);

  function revealControls() {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2600);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    revealControls();
  }

  function skip(seconds: number) {
    const video = videoRef.current;
    if (!video || !seekable) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    setCurrentTime(video.currentTime);
    revealControls();
  }

  function changeVolume(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
  }

  function fmt(sec: number) {
    if (!isFinite(sec) || sec <= 0) return '0:00';
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  const seekable = isFinite(duration) && duration > 0;

  return (
    <div
      ref={wrapRef}
      className={`video-glass spatial-player relative w-full h-full bg-black rounded-[32px] overflow-hidden ${
        controlsVisible ? 'controls-visible' : ''
      }`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={() => {
          if (!controlsVisible) revealControls();
          else togglePlay();
        }}
        onPlay={() => {
          setPlaying(true);
          revealControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onVolumeChange={(event) => setVolume(event.currentTarget.muted ? 0 : event.currentTarget.volume)}
        className="w-full h-full object-contain"
      />

      <div className="spatial-shade" />

      <div className="spatial-topbar">
        <button
          onClick={toggleFullscreen}
          className="spatial-pill spatial-icon-pill"
          aria-label="Полный экран"
          title="Полный экран (F)"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>

        <div className="spatial-pill spatial-volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            style={{ '--val': `${volume * 100}%` } as React.CSSProperties}
            aria-label="Громкость"
          />
          <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 8.05v7.9A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 21 12 9 9 0 0 0 14 3.23z" />
          </svg>
        </div>
      </div>

      <div className="spatial-center-controls">
        <button
          onClick={() => skip(-5)}
          disabled={!seekable}
          className="spatial-orb spatial-orb-side"
          aria-label="Назад на 5 секунд"
        >
          <SkipLabel direction="back" seconds={5} />
        </button>
        <button
          onClick={togglePlay}
          className="spatial-orb spatial-orb-main"
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        >
          {playing ? (
            <svg width="46" height="46" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg width="46" height="46" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => skip(5)}
          disabled={!seekable}
          className="spatial-orb spatial-orb-side"
          aria-label="Вперёд на 5 секунд"
        >
          <SkipLabel direction="forward" seconds={5} />
        </button>
      </div>

      <div className="spatial-timeline spatial-pill">
        <span className="spatial-time">{seekable ? fmt(currentTime) : 'LIVE'}</span>
        <div className="spatial-scrubber">
          <input
            type="range"
            min={0}
            max={seekable ? duration : 1}
            value={seekable ? currentTime : 1}
            step={0.1}
            disabled={!seekable}
            onChange={(event) => {
              if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
              revealControls();
            }}
            style={
              {
                '--val': `${seekable ? (currentTime / duration) * 100 : 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <span className="spatial-time spatial-time-end">
          {seekable ? `-${fmt(Math.max(0, duration - currentTime))}` : 'ЭФИР'}
        </span>
      </div>
      {err && (
        <div className="absolute inset-x-0 top-0 bg-red-900/80 text-white text-sm text-center py-2">
          {err}
        </div>
      )}
    </div>
  );
});

function SkipLabel({ direction, seconds }: { direction: 'back' | 'forward'; seconds: number }) {
  const back = direction === 'back';
  return (
    <div className="skip-label">
      <span className="skip-value">{back ? '−' : '+'}{seconds}</span>
      <span className="skip-unit">сек</span>
    </div>
  );
}

export default VideoPlayer;
