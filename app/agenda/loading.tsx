export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-9 w-[420px] max-w-full rounded-full" />
      <div className="grid grid-cols-12 gap-6">
        <div className="skeleton col-span-12 h-[420px] lg:col-span-3" />
        <div className="skeleton col-span-12 h-[620px] lg:col-span-9" />
      </div>
    </div>
  );
}
