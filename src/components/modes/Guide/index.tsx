import type { Mode } from '../../Sidebar';

type Props = { onNavigate: (m: Mode) => void };

export default function Guide({ onNavigate }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Справка</div>
          <h1 className="text-5xl font-extrabold bg-gradient-to-br from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            Как пользоваться
          </h1>
          <p className="text-neutral-300 mt-3 max-w-2xl leading-relaxed">
            Плеер объединяет пять независимых режимов: локальную музыку, интернет-радио,
            IPTV-каналы, видео и аудиокниги. Всё хранится локально в вашем браузере — ничего
            никуда не уходит.
          </p>
        </header>

        {/* Overview cards */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-wider text-neutral-400 mb-3">Разделы</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            <ModeCard
              label="Музыка"
              onClick={() => onNavigate('music')}
              icon={
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              }
            />
            <ModeCard
              label="Радио"
              onClick={() => onNavigate('radio')}
              icon={
                <path d="M3.24 6.15A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.33-.75-1.86L3.24 6.15zM7 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm13-8h-2v-2h2v2z" />
              }
            />
            <ModeCard
              label="ТВ"
              onClick={() => onNavigate('iptv')}
              icon={
                <path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H7v2h10v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z" />
              }
            />
            <ModeCard
              label="Видео"
              onClick={() => onNavigate('videos')}
              icon={
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
              }
            />
            <ModeCard
              label="Аудиокниги"
              onClick={() => onNavigate('audiobooks')}
              icon={
                <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 4h2v10l-1-.75L8 14V4zm10 16H6v-1h12v1zm0-3H6V4h2v14l3-2.25L14 18V4h4v13z" />
              }
            />
          </div>
        </section>

        {/* Music */}
        <Section title="Моя музыка" anchor="music">
          <Subsection title="Как добавить треки">
            <Bullet>
              <strong>Добавить папку</strong> (Chrome / Edge / Opera) — выбираете корневую папку
              через системный диалог. Приложение рекурсивно прочитает все mp3 / flac / m4a / aac
              / ogg / wav / opus, вытащит теги и обложки.
            </Bullet>
            <Bullet>
              <strong>Добавить файлы</strong> — отдельные файлы. Работает во всех браузерах,
              включая Firefox и Safari, но не сохраняется между сессиями.
            </Bullet>
            <Bullet>
              <strong>Добавить ZIP</strong> — архив <code className="text-accent">.zip</code>{' '}
              с mp3-файлами. Сам архив сохраняется в IndexedDB, треки извлекаются по запросу.
              Каждый ZIP автоматически становится отдельным плейлистом с именем архива.
            </Bullet>
          </Subsection>
          <Subsection title="Плейлисты">
            <Bullet>
              <Badge>Папка</Badge> Если в выбранной папке есть подпапки (например,{' '}
              <code className="text-accent">Music/Rock</code>,{' '}
              <code className="text-accent">Music/Chill</code>), каждая подпапка верхнего уровня
              автоматически становится плейлистом.
            </Bullet>
            <Bullet>
              <Badge>ZIP</Badge> Любой добавленный ZIP-архив тоже превращается в плейлист
              автоматически — его удаление с вкладки «Плейлисты» удаляет и сам архив.
            </Bullet>
            <Bullet>
              <Badge>Свой</Badge> На вкладке «Плейлисты» нажмите{' '}
              <Kbd>+ Создать плейлист</Kbd>, дайте имя. Откройте плейлист и нажмите{' '}
              <Kbd>+ Добавить треки</Kbd> — выберите треки галочками.
            </Bullet>
            <Bullet>
              На карточке любого трека наведите курсор — появится «<strong>+</strong>».
              Открывается окно выбора плейлиста для этого трека.
            </Bullet>
          </Subsection>
          <Subsection title="Сортировка и вид">
            <Bullet>
              На вкладке «Треки» в правом верхнем углу — выпадающий список сортировки:{' '}
              <strong>Недавно добавленные</strong>, <strong>По имени (А-Я / Я-А)</strong>,{' '}
              <strong>По исполнителю</strong>. «Недавно» считается по{' '}
              <code className="text-accent">lastModified</code> файла, либо по дате добавления ZIP-архива.
            </Bullet>
            <Bullet>
              Рядом — переключатель <strong>сетка ↔ список</strong>. Списковый вид построен как
              в детали плейлиста и удобен для длинных библиотек.
            </Bullet>
          </Subsection>
          <Subsection title="Случайное воспроизведение">
            <Bullet>
              Левая иконка <Kbd>↕</Kbd> в Player Bar включает shuffle. При включённом перемешивании
              «Следующий трек» выберется случайно из текущей очереди.
            </Bullet>
          </Subsection>
          <Subsection title="Удаление">
            <Bullet>
              Любое удаление трека, ZIP-плейлиста или ручного плейлиста открывает кастомную
              модалку подтверждения в стиле Aurora — никаких системных <code className="text-accent">confirm()</code>.
              Исходные файлы на диске не трогаются.
            </Bullet>
          </Subsection>
          <Tip>
            <strong>File System Access API</strong> запоминает разрешение на папку — при следующем
            заходе достаточно подтвердить доступ, выбирать заново не придётся.
          </Tip>
        </Section>

        {/* Radio */}
        <Section title="Радио" anchor="radio">
          <Subsection title="Добавление станции">
            <Bullet>
              Нажмите <Kbd>+ Добавить радиостанцию</Kbd>. Введите название и URL потока (как
              правило, <code className="text-accent">.aacp</code>, <code className="text-accent">.aac</code> или{' '}
              <code className="text-accent">.mp3</code>). Иконку можно задать ссылкой или загрузить
              как локальный файл — она сохранится прямо в IndexedDB и переживёт перезапуск.
            </Bullet>
          </Subsection>
          <Subsection title="Редактирование и удаление">
            <Bullet>
              На карточке станции наведите курсор — появятся <strong>карандаш</strong> (редактирование
              названия, URL потока и иконки) и <strong>корзина</strong> с кастомным окном подтверждения.
            </Bullet>
          </Subsection>
          <Subsection title="Что важно знать про URL потока">
            <Bullet>
              <strong>HTTPS только.</strong> Если сайт открыт по HTTPS, поток тоже должен быть
              HTTPS — браузер блокирует mixed content.
            </Bullet>
            <Bullet>
              <strong>CORS.</strong> Не все станции отдают корректные заголовки. Если поток
              не запускается — проблема, скорее всего, в этом, нужно прокси.
            </Bullet>
            <Bullet>
              «Сейчас играет» (ICY-метаданные) — браузер их не отдаёт скриптам. Этот функционал
              требует серверного прокси.
            </Bullet>
          </Subsection>
        </Section>

        {/* TV */}
        <Section title="ТВ (IPTV)" anchor="iptv">
          <Subsection title="Плейлисты из public/iptv/">
            <Bullet>
              <Badge>Bundled</Badge> При каждом запуске Aurora перечитывает{' '}
              <code className="text-accent">public/iptv/index.json</code> и парсит указанные в нём
              файлы. Чтобы добавить свой плейлист, положите файл в эту папку и впишите его в
              манифест:
            </Bullet>
            <Bullet>
              <code className="text-accent">{`[{ "name": "Мой IPTV", "file": "my.m3u" }]`}</code>
            </Bullet>
            <Bullet>
              Файлы читаются с <code className="text-accent">cache: 'no-store'</code> — обновили
              файл, перезагрузили вкладку, новые каналы появились. Никаких сбросов IndexedDB.
              Bundled-плейлисты не удаляются из UI (они приходят из репозитория).
            </Bullet>
          </Subsection>
          <Subsection title="Временные плейлисты">
            <Bullet>
              <strong>Из файла</strong> — кнопка <Kbd>+ Добавить M3U</Kbd>, выберите{' '}
              <code className="text-accent">.m3u</code> / <code className="text-accent">.m3u8</code>.
            </Bullet>
            <Bullet>
              <strong>По URL</strong> — там же вставьте ссылку на плейлист. Сервер должен отдавать
              корректные CORS-заголовки.
            </Bullet>
            <Bullet>
              Такие плейлисты сохраняются в IndexedDB и удаляются крестиком с подтверждением.
            </Bullet>
          </Subsection>
          <Subsection title="Просмотр канала">
            <Bullet>
              Клик по каналу — открывается страница: плеер слева, справа панель с поиском,{' '}
              <strong>чип-рейлом категорий</strong> (с количеством каналов) и списком каналов.
            </Bullet>
            <Bullet>
              В шапке: <Kbd>◀</Kbd>/<Kbd>▶</Kbd> переключают каналы по порядку, счётчик показывает
              N&nbsp;/&nbsp;M.
            </Bullet>
            <Bullet>
              <Kbd>F</Kbd> — переключение полноэкранного режима (игнорируется в полях ввода).
            </Bullet>
          </Subsection>
          <Subsection title="Поддерживаемые форматы">
            <Bullet>
              <code className="text-accent">.m3u8</code> (HLS) — через hls.js, либо нативно в
              Safari.
            </Bullet>
            <Bullet>
              <code className="text-accent">.ts</code> (MPEG-TS) — через mpegts.js.
            </Bullet>
            <Bullet>
              Остальные ссылки — через нативный <code className="text-accent">&lt;video&gt;</code>.
            </Bullet>
          </Subsection>
        </Section>

        {/* Videos */}
        <Section title="Видео" anchor="videos">
          <Subsection title="Добавление видео">
            <Bullet>
              <Kbd>+ Добавить видео</Kbd> — выбор одного или нескольких файлов. В Chrome / Edge /
              Opera сохраняется handle файла на диске, в остальных браузерах — blob внутри
              IndexedDB. Поддерживаются <code className="text-accent">mp4</code>,{' '}
              <code className="text-accent">webm</code>, <code className="text-accent">mkv</code>,{' '}
              <code className="text-accent">mov</code>, <code className="text-accent">m4v</code>,{' '}
              <code className="text-accent">avi</code>, <code className="text-accent">ogv</code>.
            </Bullet>
          </Subsection>
          <Subsection title="Редактирование и удаление">
            <Bullet>
              На карточке — карандаш (название + свой постер) и корзина с подтверждением.
            </Bullet>
          </Subsection>
          <Subsection title="Воспроизведение">
            <Bullet>
              Используется тот же плеер, что в ТВ. Доступны фуллскрин по <Kbd>F</Kbd>, перемотка
              ±5 секунд и регулировка громкости.
            </Bullet>
            <Bullet>
              Декодинг идёт через нативные кодеки браузера — экзотические потоки в mkv / avi могут
              не воспроизвестись.
            </Bullet>
          </Subsection>
        </Section>

        {/* Audiobooks */}
        <Section title="Аудиокниги" anchor="audiobooks">
          <Subsection title="Как загрузить книгу">
            <Bullet>
              <Badge>Папка</Badge> Chrome / Edge / Opera. Папка с mp3-файлами глав. Опционально
              положите <code className="text-accent">cover.jpg</code> или{' '}
              <code className="text-accent">cover.png</code> в эту же папку — будет обложкой.
            </Bullet>
            <Bullet>
              <Badge>ZIP</Badge> Архив <code className="text-accent">.zip</code>, внутри —
              mp3-файлы глав. Работает во всех браузерах. Архив целиком сохраняется в IndexedDB
              и распаковывается по запросу.
            </Bullet>
          </Subsection>
          <Subsection title="Редактирование и удаление">
            <Bullet>
              На карточке книги — карандаш (название и обложка) и корзина (с подтверждением в
              стиле Aurora). Своя обложка хранится в IndexedDB и имеет приоритет над{' '}
              <code className="text-accent">cover.*</code> из источника.
            </Bullet>
          </Subsection>
          <Subsection title="Порядок глав">
            <Bullet>
              Главы сортируются по имени файла с поддержкой чисел: «chapter2.mp3» идёт перед
              «chapter10.mp3». Если ваши главы пронумерованы как{' '}
              <code className="text-accent">01_intro.mp3</code> /{' '}
              <code className="text-accent">02_part1.mp3</code> — порядок будет правильным.
            </Bullet>
          </Subsection>
          <Subsection title="Управление">
            <Bullet>
              Кнопки <Kbd>-30</Kbd> и <Kbd>+30</Kbd> — перемотка на 30 секунд назад / вперёд.
            </Bullet>
            <Bullet>
              <Kbd>◀</Kbd>/<Kbd>▶</Kbd> — переключение глав.
            </Bullet>
            <Bullet>
              Скорость воспроизведения: 0.75× / 1× / 1.25× / 1.5× / 1.75× / 2×. Сохраняется между
              главами.
            </Bullet>
            <Bullet>
              Активная глава подсвечена зелёным с анимированным эквалайзером.
            </Bullet>
          </Subsection>
          <Tip>
            Нижний Player Bar в режимах аудиокниг, ТВ и Видео скрыт — используется встроенный
            плеер на самой странице.
          </Tip>
        </Section>

        {/* Storage */}
        <Section title="Хранилище и сброс" anchor="storage">
          <Subsection title="Что лежит в IndexedDB">
            <Bullet>
              На вкладке «Хранилище» показан снимок: количество станций, IPTV-плейлистов,
              музыкальных файлов и ZIP-архивов, аудиокниг и видео, а также суммарный объём.
            </Bullet>
          </Subsection>
          <Subsection title="Частичный сброс">
            <Bullet>
              Каждая карточка имеет свою кнопку очистки: <strong>только музыка</strong>,{' '}
              <strong>только аудиокниги</strong>, <strong>только видео</strong>. Перед сбросом —
              кастомное окно подтверждения.
            </Bullet>
          </Subsection>
          <Subsection title="Полный сброс">
            <Bullet>
              Кнопка <Kbd>Сбросить всё</Kbd> в конце страницы очищает <em>всё</em> в IndexedDB
              Aurora. Исходные файлы на компьютере остаются.
            </Bullet>
          </Subsection>
        </Section>

        {/* Browser compatibility */}
        <Section title="Совместимость браузеров" anchor="compat">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 text-xs uppercase tracking-wider text-neutral-400 border-b border-white/10">
              <div className="p-3">Возможность</div>
              <div className="p-3 text-center">Chrome / Edge</div>
              <div className="p-3 text-center">Firefox</div>
              <div className="p-3 text-center">Safari</div>
            </div>
            <CompatRow feature="Добавить папку (FS Access)" chrome="yes" firefox="no" safari="no" />
            <CompatRow feature="Добавить файлы" chrome="yes" firefox="yes" safari="yes" />
            <CompatRow feature="HLS (.m3u8)" chrome="yes" firefox="yes" safari="yes" note="native" />
            <CompatRow feature="MPEG-TS (.ts)" chrome="yes" firefox="yes" safari="partial" />
            <CompatRow feature="DASH (.mpd)" chrome="partial" firefox="no" safari="no" />
            <CompatRow feature="ZIP-архив книги" chrome="yes" firefox="yes" safari="yes" />
            <CompatRow feature="Видео mp4 / webm" chrome="yes" firefox="yes" safari="yes" />
            <CompatRow feature="Видео mkv / avi" chrome="partial" firefox="partial" safari="partial" note="зависит от кодеков" />
            <CompatRow feature="Полный экран (F)" chrome="yes" firefox="yes" safari="yes" />
          </div>
        </Section>

        {/* Privacy */}
        <Section title="Где хранятся данные" anchor="privacy">
          <Bullet>
            Список радиостанций (вместе с иконками-blob), ваши IPTV-плейлисты, плейлисты музыки,
            file-handles библиотеки, ZIP-архивы книг и музыки, видео и их постеры, обложки книг —
            всё в <strong>IndexedDB вашего браузера</strong>. Никакого backend, никаких аккаунтов.
          </Bullet>
          <Bullet>
            Bundled IPTV-плейлисты (из <code className="text-accent">public/iptv/</code>) и
            стартовый <code className="text-accent">radio.json</code> приходят из репозитория и
            перечитываются при каждом запуске — в IndexedDB они не дублируются.
          </Bullet>
          <Bullet>
            Очистка данных сайта в браузере (или «Сбросить всё» в Хранилище) удалит всё локальное.
            Исходные файлы на диске не трогаются.
          </Bullet>
        </Section>
      </div>
    </div>
  );
}

function ModeCard({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card rounded-2xl p-4 text-left flex flex-col items-start gap-2"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center text-accent">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          {icon}
        </svg>
      </div>
      <div className="text-sm font-semibold">{label}</div>
    </button>
  );
}

function Section({
  title,
  anchor,
  children,
}: {
  title: string;
  anchor: string;
  children: React.ReactNode;
}) {
  return (
    <section id={anchor} className="mb-12">
      <h2 className="text-2xl font-bold mb-5">{title}</h2>
      <div className="glass rounded-2xl p-6 space-y-5">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{title}</h3>
      <ul className="space-y-2 text-sm text-neutral-200 leading-relaxed">{children}</ul>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="text-accent mt-2 shrink-0">
        <svg width="6" height="6" viewBox="0 0 6 6">
          <circle cx="3" cy="3" r="3" fill="currentColor" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded-md bg-white/10 border border-white/15 text-xs font-mono">
      {children}
    </kbd>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-semibold mr-1">
      {children}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm">
      <div className="text-accent shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 21h6v-2H9v2zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" />
        </svg>
      </div>
      <div>{children}</div>
    </div>
  );
}

function CompatRow({
  feature,
  chrome,
  firefox,
  safari,
  note,
}: {
  feature: string;
  chrome: 'yes' | 'no' | 'partial';
  firefox: 'yes' | 'no' | 'partial';
  safari: 'yes' | 'no' | 'partial';
  note?: string;
}) {
  return (
    <div className="grid grid-cols-4 text-sm border-b border-white/5 last:border-0">
      <div className="p-3">
        {feature}
        {note && <span className="text-neutral-500 ml-2 text-xs">({note})</span>}
      </div>
      <Cell v={chrome} />
      <Cell v={firefox} />
      <Cell v={safari} />
    </div>
  );
}

function Cell({ v }: { v: 'yes' | 'no' | 'partial' }) {
  const map = {
    yes: { c: 'text-accent', s: '✓' },
    no: { c: 'text-red-400/80', s: '✕' },
    partial: { c: 'text-amber-400', s: '◐' },
  } as const;
  return <div className={`p-3 text-center ${map[v].c}`}>{map[v].s}</div>;
}
