import { useEffect, useState } from 'react';
import { loadBooks, saveBooks, type StoredBook } from '../../../lib/indexedDb';
import { supportsFileSystemAccess } from '../../../lib/fileSystem';
import { buildBook, type Book } from './lib';
import BookPage from './BookPage';
import { usePlayer } from '../../../store/playerStore';

export default function Audiobooks() {
  const [stored, setStored] = useState<StoredBook[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const removeTrackFromPlayer = usePlayer((state) => state.removeTrack);

  useEffect(() => {
    (async () => {
      const list = await loadBooks();
      setStored(list);
      await rebuild(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onStorageChange = async () => {
      const list = await loadBooks();
      setStored(list);
      await rebuild(list);
    };
    window.addEventListener('aurora-storage-changed', onStorageChange);
    return () => window.removeEventListener('aurora-storage-changed', onStorageChange);
  }, []);

  async function rebuild(list: StoredBook[]) {
    setLoading(true);
    const built: Book[] = [];
    for (const s of list) {
      const b = await buildBook(s);
      if (b) built.push(b);
    }
    setBooks(built);
    setLoading(false);
  }

  async function persist(next: StoredBook[]) {
    setStored(next);
    await saveBooks(next);
    await rebuild(next);
  }

  async function addFromFolder() {
    try {
      // @ts-ignore
      const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      const entry: StoredBook = {
        id: `book:${Date.now()}`,
        kind: 'folder',
        title: dir.name,
        dirHandle: dir,
        addedAt: Date.now(),
      };
      await persist([...stored, entry]);
    } catch {
      /* canceled */
    } finally {
      setAdding(false);
    }
  }

  async function addFromZip(file: File) {
    const entry: StoredBook = {
      id: `book:${Date.now()}`,
      kind: 'zip',
      title: file.name.replace(/\.zip$/i, ''),
      blob: file,
      fileName: file.name,
      addedAt: Date.now(),
    };
    await persist([...stored, entry]);
    setAdding(false);
  }

  async function removeBook(id: string) {
    if (!confirm('Удалить эту книгу из библиотеки?')) return;
    const book = books.find((item) => item.id === id);
    book?.chapters.forEach((chapter) => removeTrackFromPlayer(chapter.id));
    await persist(stored.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
  }

  const openBook = books.find((b) => b.id === openId);
  if (openBook) {
    return <BookPage book={openBook} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
            Аудиокниги
          </h1>
          <div className="text-sm text-neutral-400 mt-1">
            {books.length === 0 ? 'Библиотека пуста' : `${books.length} в библиотеке`}
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="bg-accent hover:bg-accentHover text-black text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg shadow-accent/30 transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Добавить книгу
        </button>
      </div>

      {loading && <div className="text-neutral-400">Загрузка…</div>}

      {!loading && books.length === 0 && (
        <EmptyState onAdd={() => setAdding(true)} />
      )}

      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {books.map((b) => (
          <div key={b.id} className="group relative glass-card rounded-2xl p-4">
            <button onClick={() => setOpenId(b.id)} className="w-full text-left">
              <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-white/15 to-white/[0.03] flex items-center justify-center text-neutral-400 shadow-md shadow-black/40">
                {b.cover ? (
                  <img src={b.cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h2v10l-1-.75L8 14V4zm10 16H6v-1h12v1zm0-3H6V4h2v14l3-2.25L14 18V4h4v13z" />
                  </svg>
                )}
              </div>
              <div className="text-sm font-semibold truncate">{b.title}</div>
              <div className="text-xs text-neutral-400">{b.chapters.length} глав</div>
            </button>
            <button
              onClick={() => removeBook(b.id)}
              className="track-action top-2 right-2"
              aria-label="Удалить"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zM9 9v8h2V9H9zm4 0v8h2V9h-2zm1.5-5-1-1h-3l-1 1H6v2h12V4h-3.5z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <AddBookModal
          onClose={() => setAdding(false)}
          onPickFolder={addFromFolder}
          onPickZip={addFromZip}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass rounded-3xl p-12 text-center mt-8 max-w-2xl mx-auto">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center shadow-lg shadow-accent/30">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#0b0b0c">
          <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h2v10l-1-.75L8 14V4zm10 16H6v-1h12v1zm0-3H6V4h2v14l3-2.25L14 18V4h4v13z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2">Здесь будут ваши аудиокниги</h2>
      <p className="text-neutral-400 mb-6 text-sm">
        Добавьте папку с mp3-главами или zip-архив. Главы автоматически отсортируются по имени.
      </p>
      <button
        onClick={onAdd}
        className="bg-accent hover:bg-accentHover text-black text-sm font-semibold px-6 py-2.5 rounded-full"
      >
        Добавить первую книгу
      </button>
    </div>
  );
}

function AddBookModal({
  onClose,
  onPickFolder,
  onPickZip,
}: {
  onClose: () => void;
  onPickFolder: () => void;
  onPickZip: (file: File) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 w-full max-w-md"
      >
        <h2 className="text-xl font-bold mb-1">Добавить книгу</h2>
        <div className="text-xs text-neutral-400 mb-5">
          Выберите способ загрузки. Главы расположатся в алфавитном/числовом порядке имён файлов.
        </div>
        <div className="grid grid-cols-2 gap-3">
          {supportsFileSystemAccess() && (
            <button
              onClick={onPickFolder}
              className="glass hover:bg-white/10 transition-all rounded-2xl p-5 text-center"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
                </svg>
              </div>
              <div className="text-sm font-semibold">Папка</div>
              <div className="text-xs text-neutral-400 mt-1">с mp3-главами</div>
            </button>
          )}
          <label className="glass hover:bg-white/10 transition-all rounded-2xl p-5 text-center cursor-pointer">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent/15 flex items-center justify-center text-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-7 5h2v3h2l-3 3-3-3h2v-3z" />
              </svg>
            </div>
            <div className="text-sm font-semibold">ZIP-архив</div>
            <div className="text-xs text-neutral-400 mt-1">.zip с главами</div>
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickZip(f);
              }}
            />
          </label>
        </div>
        {!supportsFileSystemAccess() && (
          <div className="text-xs text-neutral-500 mt-4 text-center">
            Загрузка папкой доступна только в Chrome / Edge / Opera.
          </div>
        )}
        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="text-sm text-neutral-300 hover:text-white px-4 py-2">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
