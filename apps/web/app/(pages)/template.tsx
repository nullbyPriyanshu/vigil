// Re-mounts on every navigation inside the app, so each page eases in
// instead of snapping into place.
export default function PagesTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-page-in">{children}</div>;
}
