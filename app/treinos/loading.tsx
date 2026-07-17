export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-9 w-[300px] max-w-full rounded-full" />
      <div className="grid grid-cols-12 gap-6">
        <div className="skeleton col-span-12 h-[260px] lg:col-span-8" />
        <div className="skeleton col-span-12 h-[260px] lg:col-span-4" />
        <div className="skeleton col-span-6 h-[120px] lg:col-span-3" />
        <div className="skeleton col-span-6 h-[120px] lg:col-span-3" />
        <div className="skeleton col-span-6 h-[120px] lg:col-span-3" />
        <div className="skeleton col-span-6 h-[120px] lg:col-span-3" />
      </div>
    </div>
  );
}
