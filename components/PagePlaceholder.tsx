export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="text-xl font-bold text-[#2C7001]">
        {title}
      </h1>
      <p className="text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
