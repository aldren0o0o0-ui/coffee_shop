export default function PlaceholderPage({
  title,
  description,
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-stone-900">
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-stone-600">
        {description}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
        <p className="font-medium text-stone-700">
          This workspace is ready for development.
        </p>
      </div>
    </section>
  );
}