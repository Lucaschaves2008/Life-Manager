export default function Loading() {
  return (
    <div className="flex flex-col gap-6 pt-2" aria-busy>
      <div>
        <div className="skeleton h-12 w-72" />
        <div className="skeleton mt-3 h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="skeleton h-64 rounded-[20px] xl:col-span-8" />
        <div className="skeleton h-64 rounded-[20px] xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="skeleton h-32 rounded-[20px]" />
        <div className="skeleton h-32 rounded-[20px]" />
        <div className="skeleton h-32 rounded-[20px]" />
        <div className="skeleton h-32 rounded-[20px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="skeleton h-80 rounded-[20px] xl:col-span-5" />
        <div className="skeleton h-80 rounded-[20px] xl:col-span-4" />
        <div className="skeleton h-80 rounded-[20px] xl:col-span-3" />
      </div>
    </div>
  );
}
