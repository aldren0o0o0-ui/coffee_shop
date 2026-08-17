import { useAuth } from "../auth/AuthContext";


export default function Dashboard() {
  const { user, hasRole } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-amber-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          Today at a glance
        </p>

        <h2 className="mt-3 text-3xl font-bold">
          Good day, {user.first_name}
        </h2>

        <p className="mt-2 max-w-xl text-amber-100">
          Review shop activity and continue where your
          team left off.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Today’s sales", "No sales yet"],
          ["Orders", "No orders yet"],
          ["Items running low", "No alerts"],
          ["Team on duty", "Not configured"],
        ].map(([label, value]) => (
          <article
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            key={label}
          >
            <p className="text-sm text-stone-500">
              {label}
            </p>

            <p className="mt-3 text-xl font-bold text-stone-900">
              {value}
            </p>
          </article>
        ))}
      </section>

      {hasRole("owner") && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-stone-900">
            Owner shortcuts
          </h2>

          <p className="mt-2 text-stone-600">
            Common tasks for managing your coffee shop.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Add a team member",
              "Update the menu",
              "Review stock",
            ].map((label) => (
              <button
                className="rounded-xl border border-stone-200 p-4 text-left font-semibold text-stone-800 transition hover:border-amber-300 hover:bg-amber-50"
                key={label}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}