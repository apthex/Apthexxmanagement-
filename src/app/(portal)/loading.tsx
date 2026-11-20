export default function PortalLoading() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-8 w-56 rounded" />
        <div className="skeleton h-3 w-96 max-w-full rounded" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
      </div>
    </div>
  );
}
