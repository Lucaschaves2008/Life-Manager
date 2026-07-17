export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-9 w-[420px] max-w-full rounded-full" />
      <div className="grid grid-cols-12 gap-6">
        <div className="skeleton col-span-12 h-[188px]" />
        <div className="skeleton col-span-12 h-[320px] lg:col-span-8" />
        <div className="skeleton col-span-12 h-[320px] lg:col-span-4" />
        <div className="skeleton col-span-12 h-[280px] lg:col-span-5" />
        <div className="skeleton col-span-12 h-[280px] lg:col-span-4" />
        <div className="skeleton col-span-12 h-[280px] lg:col-span-3" />
      </div>
    </div>
  );
}
