import { NavLink } from "react-router-dom";

import { getNavigationForUser } from "../navigation";


function navigationClass({ isActive }) {
  const base =
    "block rounded-xl px-4 py-3 text-sm font-medium transition";

  return isActive
    ? `${base} bg-amber-100 text-amber-950`
    : `${base} text-stone-600 hover:bg-stone-100 hover:text-stone-950`;
}


export default function Sidebar({
  user,
  isOpen,
  onClose,
}) {
  const navigation = getNavigationForUser(user);

  return (
    <>
      {isOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-stone-950/40 lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-stone-200 bg-white transition-transform duration-200",
          isOpen
            ? "translate-x-0"
            : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-20 items-center justify-between border-b border-stone-200 px-6">
          <div>
            <p className="text-lg font-bold text-amber-950">
              ldrn&apos;s coffee
            </p>

            <p className="text-xs text-stone-500">
              Shop workspace
            </p>
          </div>

          <button
            aria-label="Close navigation"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto p-4"
        >
          {navigation.map((item) => (
            <NavLink
              className={navigationClass}
              end={item.path === "/"}
              key={item.path}
              onClick={onClose}
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-stone-200 p-4">
          <div className="rounded-xl bg-stone-100 p-4">
            <p className="truncate font-semibold text-stone-900">
              {user.first_name} {user.last_name}
            </p>

            <p className="mt-1 truncate text-sm text-stone-500">
              {user.email}
            </p>

            <div className="mt-3 flex flex-wrap gap-1">
              {user.roles.map((role) => (
                <span
                  className="rounded-full bg-white px-2 py-1 text-xs font-medium capitalize text-amber-900"
                  key={role.role_name}
                >
                  {role.role_name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}