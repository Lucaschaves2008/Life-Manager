export default function Loading() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="skeleton col-span-12 h-[164px] lg:col-span-5" />
      <div className="skeleton col-span-6 h-[164px] lg:col-span-3" />
      <div className="skeleton col-span-6 h-[164px] lg:col-span-4" />
      <div className="skeleton col-span-12 h-[188px] lg:col-span-4" />
      <div className="skeleton col-span-12 h-[340px] lg:col-span-8" />
      <div className="skeleton col-span-12 h-[280px] lg:col-span-4" />
      <div className="skeleton col-span-12 h-[320px] lg:col-span-8" />
    </div>
  );
}
