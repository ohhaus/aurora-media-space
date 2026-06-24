type Props = { playing: boolean; bars?: number; className?: string };

export default function EqualizerAnimation({ playing, bars = 4, className = '' }: Props) {
  return (
    <span className={`inline-flex items-end h-4 leading-none ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={`eq-bar ${playing ? '' : 'paused'}`} />
      ))}
    </span>
  );
}
