const AUDIO_EXT = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.opus', '.wma'];
const VIDEO_EXT = ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi', '.ogv'];

export function isAudioFilename(name: string) {
  const lower = name.toLowerCase();
  return AUDIO_EXT.some((e) => lower.endsWith(e));
}

export function isVideoFilename(name: string) {
  const lower = name.toLowerCase();
  return VIDEO_EXT.some((e) => lower.endsWith(e));
}

/**
 * Detect macOS AppleDouble metadata entries inside zips:
 *   - `__MACOSX/...` directory
 *   - any file whose basename starts with `._`
 * These are resource forks, not real audio/video.
 */
export function isMacOsMetadataPath(path: string) {
  if (path.startsWith('__MACOSX/') || path.includes('/__MACOSX/')) return true;
  const base = path.split('/').pop() ?? path;
  return base.startsWith('._');
}

export function supportsFileSystemAccess(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

/**
 * Ensure we still have read permission for a previously-persisted handle.
 * Returns true if granted, false if denied.
 */
export async function ensurePermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'read',
): Promise<boolean> {
  // @ts-ignore — non-standard but widely shipped
  const opts = { mode } as any;
  // @ts-ignore
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  // @ts-ignore
  if ((await handle.requestPermission?.(opts)) === 'granted') return true;
  return false;
}

/** Recursively collect audio file handles from a directory handle. */
export async function* walkAudio(
  dir: FileSystemDirectoryHandle,
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  // @ts-ignore — entries() exists at runtime
  for await (const [name, entry] of (dir as any).entries()) {
    if (isMacOsMetadataPath(name)) continue;
    if (entry.kind === 'file') {
      if (isAudioFilename(name)) yield { handle: entry, path: name };
    } else if (entry.kind === 'directory') {
      for await (const inner of walkAudio(entry)) {
        yield { ...inner, path: `${name}/${inner.path}` };
      }
    }
  }
}
