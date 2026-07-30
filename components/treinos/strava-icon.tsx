/** Logo oficial do Strava (o "pico" duplo), em SVG vetorial fiel à marca. */
export function StravaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M10.7 0 4.5 12.6h3.4L10.7 7l2.9 5.6h3.4L10.7 0Z"
        fill="currentColor"
      />
      <path
        d="M14.8 12.6 13 16.2l-1.8-3.6H7.8l5.2 10.4L18.2 12.6h-3.4Z"
        fill="currentColor"
        opacity=".65"
      />
    </svg>
  );
}
