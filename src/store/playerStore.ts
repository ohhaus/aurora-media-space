import { create } from 'zustand';

export type Track = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string; // object URL for cover
  /** Async resolver returning a playable Blob URL (handles permission requests). */
  resolveSrc: () => Promise<string>;
};

export type Station = {
  id: string;
  name: string;
  streamUrl: string;
  iconUrl?: string;
};

export type Playing =
  | { kind: 'music'; track: Track; src: string }
  | { kind: 'radio'; station: Station; src: string };

type State = {
  current: Playing | null;
  /** Music queue (track ids in order) plus index; null when not in music mode. */
  queue: Track[] | null;
  queueIndex: number;

  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  playbackRate: number;
};

type Actions = {
  playMusic: (track: Track, queue?: Track[], index?: number) => Promise<void>;
  playRadio: (station: Station) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setProgress: (p: number) => void;
  setDuration: (d: number) => void;
  seek: (sec: number) => void;
  /** Called by PlayerBar's <audio> on play/pause events to keep state in sync. */
  setIsPlaying: (b: boolean) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackRate: (n: number) => void;
  /** PlayerBar registers its audio element here so actions can drive it. */
  bindAudio: (el: HTMLAudioElement | null) => void;
  removeTrack: (trackId: string) => void;
};

let audioEl: HTMLAudioElement | null = null;

export const usePlayer = create<State & Actions>((set, get) => ({
  current: null,
  queue: null,
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
  playbackRate: 1,

  bindAudio: (el) => {
    audioEl = el;
    if (el) {
      el.volume = get().volume;
      el.loop = get().repeat;
    }
  },

  playMusic: async (track, queue, index) => {
    const src = await track.resolveSrc();
    set({
      current: { kind: 'music', track, src },
      queue: queue ?? [track],
      queueIndex: index ?? 0,
      progress: 0,
      duration: 0,
    });
    if (audioEl) {
      audioEl.src = src;
      audioEl.loop = get().repeat;
      audioEl.playbackRate = get().playbackRate;
      audioEl.play().catch(() => {});
    }
  },

  playRadio: (station) => {
    set({
      current: { kind: 'radio', station, src: station.streamUrl },
      queue: null,
      queueIndex: -1,
      progress: 0,
      duration: 0,
    });
    if (audioEl) {
      audioEl.src = station.streamUrl;
      audioEl.loop = false;
      audioEl.playbackRate = 1;
      audioEl.play().catch(() => {});
    }
  },

  togglePlay: () => {
    if (!audioEl || !get().current) return;
    if (audioEl.paused) audioEl.play().catch(() => {});
    else audioEl.pause();
  },

  next: () => {
    const { queue, queueIndex, shuffle } = get();
    if (!queue || queueIndex < 0) return;
    let ni: number;
    if (shuffle && queue.length > 1) {
      do {
        ni = Math.floor(Math.random() * queue.length);
      } while (ni === queueIndex);
    } else {
      ni = (queueIndex + 1) % queue.length;
    }
    get().playMusic(queue[ni], queue, ni);
  },

  prev: () => {
    const { queue, queueIndex } = get();
    if (!queue || queueIndex < 0) return;
    const ni = (queueIndex - 1 + queue.length) % queue.length;
    get().playMusic(queue[ni], queue, ni);
  },

  setVolume: (v) => {
    set({ volume: v });
    if (audioEl) audioEl.volume = v;
  },

  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: d }),
  seek: (sec) => {
    if (audioEl) audioEl.currentTime = sec;
  },
  setIsPlaying: (b) => set({ isPlaying: b }),
  toggleShuffle: () => set({ shuffle: !get().shuffle }),
  toggleRepeat: () => {
    const repeat = !get().repeat;
    set({ repeat });
    if (audioEl) audioEl.loop = repeat && get().current?.kind === 'music';
  },
  setPlaybackRate: (n) => {
    set({ playbackRate: n });
    if (audioEl) audioEl.playbackRate = n;
  },
  removeTrack: (trackId) => {
    const { current, queue, queueIndex } = get();
    const nextQueue = queue?.filter((track) => track.id !== trackId) ?? null;
    const removingCurrent = current?.kind === 'music' && current.track.id === trackId;
    if (removingCurrent) {
      audioEl?.pause();
      if (audioEl) audioEl.removeAttribute('src');
    }
    set({
      current: removingCurrent ? null : current,
      isPlaying: removingCurrent ? false : get().isPlaying,
      progress: removingCurrent ? 0 : get().progress,
      duration: removingCurrent ? 0 : get().duration,
      queue: nextQueue,
      queueIndex: nextQueue?.length
        ? Math.min(queueIndex, nextQueue.length - 1)
        : -1,
    });
  },
}));
