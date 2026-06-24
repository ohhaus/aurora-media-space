import type { Channel } from './indexedDb';

export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const out: Channel[] = [];
  let pending: Partial<Channel> | null = null;
  let counter = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',');
      const attrs = comma >= 0 ? line.slice(0, comma) : line;
      const name = comma >= 0 ? line.slice(comma + 1).trim() : 'Channel';
      const logo = attrs.match(/tvg-logo="([^"]+)"/i)?.[1];
      const group = attrs.match(/group-title="([^"]+)"/i)?.[1];
      pending = { name, logo, group };
    } else if (line.startsWith('#EXTGRP:')) {
      if (pending) pending.group = line.slice(8).trim();
    } else if (line.startsWith('#')) {
      // Skip other directives (#EXTM3U, #EXTVLCOPT, #PLAYLIST, etc.)
      continue;
    } else {
      // URL line
      const url = line;
      const ch: Channel = {
        id: `ch-${counter++}-${Math.random().toString(36).slice(2, 8)}`,
        name: pending?.name ?? `Channel ${counter}`,
        url,
        logo: pending?.logo,
        group: pending?.group,
      };
      out.push(ch);
      pending = null;
    }
  }
  return out;
}
