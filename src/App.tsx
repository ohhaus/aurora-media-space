import { useState } from 'react';
import Sidebar, { type Mode } from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MusicLibrary from './components/modes/MusicLibrary';
import Radio from './components/modes/Radio';
import IPTV from './components/modes/IPTV';
import Videos from './components/modes/Videos';
import Audiobooks from './components/modes/Audiobooks';
import Guide from './components/modes/Guide';
import Storage from './components/modes/Storage';

export default function App() {
  const [mode, setMode] = useState<Mode>('music');
  const hidePlayer = mode === 'iptv' || mode === 'videos' || mode === 'audiobooks';

  return (
    <div className="app-root h-screen flex flex-col text-white bg-mesh overflow-hidden">
      <div className="flex-1 flex min-h-0 min-w-0">
        <Sidebar mode={mode} onChange={setMode} />
        <main className="flex-1 min-w-0 overflow-hidden">
          {/* Mount all so async work (e.g. metadata scan) survives mode switch. */}
          <div className={mode === 'music' ? 'h-full' : 'hidden'}>
            <MusicLibrary />
          </div>
          <div className={mode === 'radio' ? 'h-full' : 'hidden'}>
            <Radio />
          </div>
          <div className={mode === 'iptv' ? 'h-full' : 'hidden'}>
            <IPTV />
          </div>
          {mode === 'videos' && (
            <div className="h-full">
              <Videos />
            </div>
          )}
          <div className={mode === 'audiobooks' ? 'h-full' : 'hidden'}>
            <Audiobooks />
          </div>
          <div className={mode === 'storage' ? 'h-full' : 'hidden'}>
            <Storage />
          </div>
          <div className={mode === 'guide' ? 'h-full' : 'hidden'}>
            <Guide onNavigate={setMode} />
          </div>
        </main>
      </div>
      <div className={hidePlayer ? 'hidden' : ''}>
        <PlayerBar />
      </div>
    </div>
  );
}
