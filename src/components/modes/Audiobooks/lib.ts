import JSZip from 'jszip';
import { parseBlob } from 'music-metadata';
import { isAudioFilename, ensurePermission } from '../../../lib/fileSystem';
import type { StoredBook } from '../../../lib/indexedDb';

export type BookChapter = {
  id: string;
  title: string;
  index: number;
  /** Promise of an object URL playable by the audio element. */
  resolveSrc: () => Promise<string>;
};

export type Book = {
  id: string;
  title: string;
  cover?: string;
  chapters: BookChapter[];
  kind: 'folder' | 'zip';
};

const IMG_RE = /\.(jpe?g|png|webp)$/i;
const COVER_RE = /^cover\.(jpe?g|png|webp)$/i;

function natCmp(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function basename(path: string) {
  return path.split('/').pop() ?? path;
}

function chapterTitle(filename: string) {
  return basename(filename).replace(/\.[^.]+$/, '');
}

/** Build a Book from a directory handle (folder source). */
export async function buildBookFromDir(stored: Extract<StoredBook, { kind: 'folder' }>): Promise<Book | null> {
  const dir = stored.dirHandle;
  if (!(await ensurePermission(dir, 'read'))) return null;

  const audioHandles: { name: string; handle: FileSystemFileHandle }[] = [];
  let coverHandle: FileSystemFileHandle | null = null;
  let fallbackImg: FileSystemFileHandle | null = null;

  // @ts-ignore — entries() exists at runtime
  for await (const [name, entry] of (dir as any).entries()) {
    if (entry.kind !== 'file') continue;
    if (isAudioFilename(name)) audioHandles.push({ name, handle: entry });
    else if (COVER_RE.test(name)) coverHandle = entry;
    else if (IMG_RE.test(name) && !fallbackImg) fallbackImg = entry;
  }

  audioHandles.sort((a, b) => natCmp(a.name, b.name));

  let cover: string | undefined;
  const pickedCover = coverHandle ?? fallbackImg;
  if (pickedCover) {
    cover = URL.createObjectURL(await pickedCover.getFile());
  } else if (audioHandles[0]) {
    // try ID3 picture from first file
    try {
      const file = await audioHandles[0].handle.getFile();
      const m = await parseBlob(file, { duration: false, skipCovers: false });
      const pic = m.common.picture?.[0];
      if (pic) cover = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: pic.format }));
    } catch {
      /* ignore */
    }
  }

  const chapters: BookChapter[] = audioHandles.map((af, i) => ({
    id: `${stored.id}::${af.name}`,
    title: chapterTitle(af.name),
    index: i,
    resolveSrc: async () => {
      await ensurePermission(dir, 'read');
      return URL.createObjectURL(await af.handle.getFile());
    },
  }));

  return { id: stored.id, title: stored.title, cover, chapters, kind: 'folder' };
}

/** Build a Book from a stored ZIP blob. */
export async function buildBookFromZip(stored: Extract<StoredBook, { kind: 'zip' }>): Promise<Book | null> {
  const zip = await JSZip.loadAsync(stored.blob);

  const audioEntries: JSZip.JSZipObject[] = [];
  let coverEntry: JSZip.JSZipObject | null = null;
  let fallbackImg: JSZip.JSZipObject | null = null;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const base = basename(entry.name);
    if (isAudioFilename(base)) audioEntries.push(entry);
    else if (COVER_RE.test(base)) coverEntry = entry;
    else if (IMG_RE.test(base) && !fallbackImg) fallbackImg = entry;
  }

  audioEntries.sort((a, b) => natCmp(a.name, b.name));

  let cover: string | undefined;
  const pickedCover = coverEntry ?? fallbackImg;
  if (pickedCover) {
    const b = await pickedCover.async('blob');
    cover = URL.createObjectURL(b);
  } else if (audioEntries[0]) {
    try {
      const firstBlob = await audioEntries[0].async('blob');
      const m = await parseBlob(firstBlob, { duration: false, skipCovers: false });
      const pic = m.common.picture?.[0];
      if (pic) cover = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: pic.format }));
    } catch {
      /* ignore */
    }
  }

  const chapters: BookChapter[] = audioEntries.map((entry, i) => ({
    id: `${stored.id}::${entry.name}`,
    title: chapterTitle(entry.name),
    index: i,
    resolveSrc: async () => {
      const audioBlob = await entry.async('blob');
      return URL.createObjectURL(audioBlob);
    },
  }));

  return { id: stored.id, title: stored.title, cover, chapters, kind: 'zip' };
}

export async function buildBook(stored: StoredBook): Promise<Book | null> {
  try {
    if (stored.kind === 'folder') return await buildBookFromDir(stored);
    return await buildBookFromZip(stored);
  } catch {
    return null;
  }
}

/** Convert chapters to player store tracks. */
export function chaptersToTracks(book: Book) {
  return book.chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    artist: book.title,
    album: book.title,
    artwork: book.cover,
    resolveSrc: ch.resolveSrc,
  }));
}
