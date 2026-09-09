import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../modules/auth/context/useAuth";
import { emptyTrashCatalog, fetchTrashCatalog } from "../modules/menu/api/menuApi";

export default function SettingsPage() {
  const { user, openPasswordModal } = useAuth();

  const [trashedItems, setTrashedItems] = useState([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [isPurgingTrash, setIsPurgingTrash] = useState(false);
  const [isConfirmPurgeOpen, setIsConfirmPurgeOpen] = useState(false);

  const [notification, setNotification] = useState({ message: "", isError: false });

  // Store profile editable state (stored in localStorage for demo store preferences)
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("coffee_shop_store_profile");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      storeName: "ldrn's coffee",
      tagline: "Artisanal Brews & Handcrafted Bakery",
      contactNumber: "+63 (912) 345-6789",
      supportEmail: "hello@ldrnscoffee.ph",
      storeAddress: "Unit 4B Ground Floor, Aurora Plaza, Metro City",
      currency: "PHP (₱)",
      operatingHours: "7:00 AM – 10:00 PM Daily",
    };
  });

  const [isSavedBanner, setIsSavedBanner] = useState(false);

  async function loadTrash() {
    setIsLoadingTrash(true);
    try {
      const data = await fetchTrashCatalog();
      setTrashedItems(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingTrash(false);
    }
  }

  useEffect(() => {
    loadTrash();
  }, []);

  function handleProfileSave(e) {
    e.preventDefault();
    localStorage.setItem("coffee_shop_store_profile", JSON.stringify(profile));
    setIsSavedBanner(true);
    setTimeout(() => setIsSavedBanner(false), 3000);
  }

  async function handlePurgeTrash() {
    setIsPurgingTrash(true);
    try {
      const res = await emptyTrashCatalog();
      setNotification({ message: res.message || "Trash bin permanently emptied.", isError: false });
      setIsConfirmPurgeOpen(false);
      loadTrash();
    } catch (err) {
      setNotification({
        message: err.response?.data?.detail || "Failed to empty trash.",
        isError: true,
      });
    } finally {
      setIsPurgingTrash(false);
      setTimeout(() => setNotification({ message: "", isError: false }), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {notification.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition ${
            notification.isError
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      {isSavedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
          Store profile preferences saved successfully.
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-amber-950">
          Store Settings
        </h2>
        <p className="text-sm text-stone-500">
          Manage shop identity, operating preferences, database maintenance, and security.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Store Profile Form */}
        <div className="space-y-6 lg:col-span-2">
          <form
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4"
            onSubmit={handleProfileSave}
          >
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-amber-950">
                Store Profile & Branding
              </h3>
              <p className="text-xs text-stone-500">
                Information displayed on customer receipts and the online portal.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Shop Name
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, storeName: e.target.value })
                  }
                  required
                  type="text"
                  value={profile.storeName}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Tagline / Header Description
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, tagline: e.target.value })
                  }
                  type="text"
                  value={profile.tagline}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Support Telephone
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, contactNumber: e.target.value })
                  }
                  type="text"
                  value={profile.contactNumber}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Customer Support Email
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, supportEmail: e.target.value })
                  }
                  type="email"
                  value={profile.supportEmail}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700">
                  Physical Store Address
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, storeAddress: e.target.value })
                  }
                  type="text"
                  value={profile.storeAddress}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Currency Standard
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/70 p-2.5 text-xs text-stone-600 focus:outline-none"
                  disabled
                  type="text"
                  value={profile.currency}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Operating Hours
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setProfile({ ...profile, operatingHours: e.target.value })
                  }
                  type="text"
                  value={profile.operatingHours}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                className="rounded-xl bg-amber-900 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-950"
                type="submit"
              >
                Save Preferences
              </button>
            </div>
          </form>

          {/* Catalog Maintenance & Database Cleaning */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-amber-950">
                Catalog & System Maintenance
              </h3>
              <p className="text-xs text-stone-500">
                Manage soft-deleted menu items and automated background workers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-4">
              <div>
                <p className="font-bold text-stone-900 text-xs">
                  Menu Trash Bin
                </p>
                <p className="text-[11px] text-stone-500">
                  {isLoadingTrash
                    ? "Scanning trash..."
                    : `${trashedItems.length} soft-deleted items currently in recycle bin.`}
                </p>
              </div>

              <button
                className="rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-700 shadow-xs transition hover:bg-rose-50 disabled:opacity-50"
                disabled={trashedItems.length === 0 || isPurgingTrash}
                onClick={() => setIsConfirmPurgeOpen(true)}
                type="button"
              >
                {isPurgingTrash ? "Purging…" : "Empty Trash Permanently"}
              </button>
            </div>

            {/* Background Workers Health */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="font-bold text-emerald-950 text-xs">
                    Order Expiry Sweeper
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Sweeping expired guest orders every 60s
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="font-bold text-emerald-950 text-xs">
                    Draft Product Cleaner
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Periodic sweep of abandoned wizard drafts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Account Security & Quick Links */}
        <div className="space-y-6">
          {/* Account Security */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-amber-950">
                Account & Security
              </h3>
              <p className="text-xs text-stone-500">
                Your authenticated credentials and password.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-stone-50 p-3">
                <p className="text-[10px] uppercase font-bold text-stone-400">Account Owner</p>
                <p className="font-bold text-stone-900 mt-0.5">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-stone-500">{user?.email}</p>
                <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  Store Owner
                </span>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2 font-semibold text-stone-700 shadow-xs transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950"
                onClick={openPasswordModal}
                type="button"
              >
                <svg className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Change Password</span>
              </button>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Workspace Shortcuts
            </h4>

            <div className="space-y-1 text-xs">
              <Link
                className="flex items-center justify-between rounded-xl p-2.5 font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-amber-950"
                to="/team"
              >
                <span>Manage Team Accounts</span>
                <span>→</span>
              </Link>
              <Link
                className="flex items-center justify-between rounded-xl p-2.5 font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-amber-950"
                to="/menu"
              >
                <span>Menu Products Catalog</span>
                <span>→</span>
              </Link>
              <Link
                className="flex items-center justify-between rounded-xl p-2.5 font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-amber-950"
                to="/inventory"
              >
                <span>Stock & Ingredients</span>
                <span>→</span>
              </Link>
              <Link
                className="flex items-center justify-between rounded-xl p-2.5 font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-amber-950"
                to="/reports"
              >
                <span>Store Financial Reports</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Empty Trash */}
      {isConfirmPurgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">
                  Purge Trash Bin?
                </h4>
                <p className="text-xs text-stone-500">
                  Permanently delete {trashedItems.length} items.
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              This action cannot be undone. All soft-deleted menu items, associated recipe links, and photos will be permanently erased.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => setIsConfirmPurgeOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                disabled={isPurgingTrash}
                onClick={handlePurgeTrash}
                type="button"
              >
                {isPurgingTrash ? "Purging…" : "Yes, Purge Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
