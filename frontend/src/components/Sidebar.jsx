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
  onOpenPasswordModal,
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
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-stone-900 text-sm">
                  {user.first_name} {user.last_name}
                </p>

                <p className="truncate text-xs text-stone-500">
                  {user.email}
                </p>
              </div>

              {onOpenPasswordModal && (
                <button
                  aria-label="Change Password"
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-200/80 hover:text-stone-800 transition"
                  onClick={() => {
                    if (onClose) onClose();
                    onOpenPasswordModal();
                  }}
                  title="Change Password"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {user.roles.map((role) => (
                <span
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-amber-900 border border-stone-200"
                  key={role.role_name}
                >
                  {role.role_name}
                </span>
              ))}
            </div>

            {onOpenPasswordModal && (
              <button
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-1.5 text-xs font-semibold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950"
                onClick={() => {
                  if (onClose) onClose();
                  onOpenPasswordModal();
                }}
                type="button"
              >
                <svg className="h-3.5 w-3.5 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Change Password</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}