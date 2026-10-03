// VANTA wordmark: five geometric letters on a 16-unit grid. The A has no crossbar, so it
// reads as the same chevron as the V, inverted: a stealth-aircraft planform.

export function Wordmark({ className, title = "VANTA" }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 16" role="img" aria-label={title} fill="currentColor">
      <polygon points="0,0 4.2,0 8,10.8 11.8,0 16,0 10.1,16 5.9,16" />
      <polygon points="25.9,0 30.1,0 36,16 31.8,16 28,5.2 24.2,16 20,16" />
      <polygon points="40,16 40,0 44,0 52,10.2 52,0 56,0 56,16 52,16 44,5.8 44,16" />
      <polygon points="60,0 76,0 76,3.6 70,3.6 70,16 66,16 66,3.6 60,3.6" />
      <polygon points="85.9,0 90.1,0 96,16 91.8,16 88,5.2 84.2,16 80,16" />
    </svg>
  );
}
