import { clear, get, set, del } from 'idb-keyval';

const K = {
  stations: 'stations',
  playlists: 'iptv-playlists',
  musicDirHandle: 'music-dir-handle',
  musicFileHandles: 'music-file-handles',
  musicPlaylists: 'music-playlists',
  musicZips: 'music-zips',
  hiddenMusicTracks: 'hidden-music-tracks',
  books: 'audiobooks',
} as const;

export async function loadStations() {
  return (await get(K.stations)) as Station[] | undefined;
}
export async function saveStations(list: Station[]) {
  await set(K.stations, list);
}

export async function loadPlaylists() {
  return (await get(K.playlists)) as Playlist[] | undefined;
}
export async function savePlaylists(list: Playlist[]) {
  await set(K.playlists, list);
}

export async function loadDirHandle() {
  return (await get(K.musicDirHandle)) as FileSystemDirectoryHandle | undefined;
}
export async function saveDirHandle(h: FileSystemDirectoryHandle) {
  await set(K.musicDirHandle, h);
}
export async function clearDirHandle() {
  await del(K.musicDirHandle);
}

export async function loadFileHandles() {
  return (await get(K.musicFileHandles)) as FileSystemFileHandle[] | undefined;
}
export async function saveFileHandles(h: FileSystemFileHandle[]) {
  await set(K.musicFileHandles, h);
}
export async function clearFileHandles() {
  await del(K.musicFileHandles);
}

export async function loadMusicPlaylists() {
  return (await get(K.musicPlaylists)) as MusicPlaylist[] | undefined;
}
export async function saveMusicPlaylists(list: MusicPlaylist[]) {
  await set(K.musicPlaylists, list);
}

export type MusicPlaylist = { id: string; name: string; trackIds: string[] };

export type StoredMusicZip = { id: string; fileName: string; blob: Blob; addedAt: number };

export async function loadMusicZips() {
  return ((await get(K.musicZips)) as StoredMusicZip[] | undefined) ?? [];
}
export async function saveMusicZips(list: StoredMusicZip[]) {
  await set(K.musicZips, list);
}

export async function loadHiddenMusicTracks() {
  return ((await get(K.hiddenMusicTracks)) as string[] | undefined) ?? [];
}
export async function saveHiddenMusicTracks(ids: string[]) {
  await set(K.hiddenMusicTracks, ids);
}

export type StoredBook =
  | { id: string; kind: 'folder'; title: string; dirHandle: FileSystemDirectoryHandle; addedAt: number }
  | { id: string; kind: 'zip'; title: string; blob: Blob; fileName: string; addedAt: number };

export async function loadBooks() {
  return ((await get(K.books)) as StoredBook[] | undefined) ?? [];
}
export async function saveBooks(list: StoredBook[]) {
  await set(K.books, list);
}

export type StorageSnapshot = {
  stations: number;
  iptvPlaylists: number;
  channels: number;
  musicZips: number;
  musicZipBytes: number;
  musicFiles: number;
  musicFolderConnected: boolean;
  hiddenTracks: number;
  musicPlaylists: number;
  audiobooks: number;
  audiobookBytes: number;
};

export async function loadStorageSnapshot(): Promise<StorageSnapshot> {
  const [stations, playlists, zips, files, dir, hidden, musicPlaylists, books] = await Promise.all([
    loadStations(),
    loadPlaylists(),
    loadMusicZips(),
    loadFileHandles(),
    loadDirHandle(),
    loadHiddenMusicTracks(),
    loadMusicPlaylists(),
    loadBooks(),
  ]);
  return {
    stations: stations?.length ?? 0,
    iptvPlaylists: playlists?.length ?? 0,
    channels: playlists?.reduce((sum, playlist) => sum + playlist.channels.length, 0) ?? 0,
    musicZips: zips.length,
    musicZipBytes: zips.reduce((sum, zip) => sum + zip.blob.size, 0),
    musicFiles: files?.length ?? 0,
    musicFolderConnected: !!dir,
    hiddenTracks: hidden.length,
    musicPlaylists: musicPlaylists?.length ?? 0,
    audiobooks: books.length,
    audiobookBytes: books.reduce(
      (sum, book) => sum + (book.kind === 'zip' ? book.blob.size : 0),
      0,
    ),
  };
}

export async function clearMusicStorage() {
  await Promise.all([
    del(K.musicDirHandle),
    del(K.musicFileHandles),
    del(K.musicPlaylists),
    del(K.musicZips),
    del(K.hiddenMusicTracks),
  ]);
}

export async function clearAudiobookStorage() {
  await del(K.books);
}

export async function clearPlayerStorage() {
  await clear();
}

// Re-export types so consumers don't need to know storage details.
export type Station = { id: string; name: string; streamUrl: string; iconUrl?: string };
export type Channel = {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
};
export type Playlist = {
  id: string;
  name: string;
  channels: Channel[];
  source: { kind: 'url'; url: string } | { kind: 'file' };
};
