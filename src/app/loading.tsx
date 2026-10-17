export default function Loading() {
  return (
    <div className="container page-space" role="status" aria-live="polite">
      <p className="eyebrow">VERTEX LEAGUE</p>
      <p>Getting things ready…</p>
      <div className="loading-bar" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
