import { useState } from "react";
import { fetchCustomerMetrics, lookupCustomer, updateCustomerPreferences } from "../api/customersApi";
import { previewWinBackAudience } from "../../engagement/api/engagementApi";

export default function CustomerProfilePage() {
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [audience, setAudience] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [prefs, setPrefs] = useState({
    dietary_notes: "",
    favorite_item_notes: "",
    marketing_consent: false,
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    try {
      const found = await lookupCustomer(email);
      if (!found) throw new Error("Customer not found.");
      setCustomer(found);
      setPrefs({
        dietary_notes: found.dietary_notes || "",
        favorite_item_notes: found.favorite_item_notes || "",
        marketing_consent: found.marketing_consent || false,
      });
      setMetrics(await fetchCustomerMetrics(found.customer_id));
    } catch (err) {
      setCustomer(null);
      setMetrics(null);
      setError(err.response?.data?.detail || err.message || "Unable to load customer.");
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    if (!customer) return;
    setIsSavingPrefs(true);
    setError("");
    setSuccessMsg("");
    try {
      const updated = await updateCustomerPreferences(customer.customer_id, prefs);
      setCustomer(updated);
      setSuccessMsg("Customer preferences saved successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to update preferences.");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-stone-900">Customer Profile & Loyalty CRM</h2>
        <p className="text-sm text-stone-500">Review customer lifetime metrics, dietary preferences, and marketing consent.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-100 cursor-pointer"
          onClick={async () => setAudience(await previewWinBackAudience(30))}
          type="button"
        >
          Preview 30-day Win-Back Audience
        </button>
      </div>

      {audience && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <span className="font-bold">{audience.eligible_customers}</span> consented customers have had no orders in the last 30 days.
        </div>
      )}

      <form className="flex gap-2" onSubmit={search}>
        <input
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white p-3 text-sm focus:border-amber-500 focus:outline-none"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Customer email address"
          required
          type="email"
          value={email}
        />
        <button className="rounded-xl bg-amber-800 px-5 text-sm font-semibold text-white transition hover:bg-amber-900 cursor-pointer">
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          {successMsg}
        </div>
      )}

      {customer && metrics && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  {customer.first_name} {customer.last_name || ""}
                </h3>
                <p className="text-xs text-stone-500">{customer.email}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Customer #{customer.customer_id}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Visits" value={metrics.visit_count} />
              <Metric label="Lifetime Spend" value={`₱${Number(metrics.lifetime_spend).toFixed(2)}`} />
              <Metric label="Avg. Order" value={`₱${Number(metrics.average_order_value).toFixed(2)}`} />
              <Metric label="Loyalty Points" value={`${metrics.loyalty_points_balance} pts`} />
            </div>
          </section>

          {/* Preferences & Dietary Section */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <h4 className="text-base font-bold text-stone-900">Preferences & Marketing Consent</h4>
            <p className="text-xs text-stone-500 mt-0.5">Customize allergies, favourite orders, and promotional outreach permission.</p>

            <form className="mt-4 space-y-4" onSubmit={handleSavePreferences}>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Dietary & Allergy Notes</label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs focus:border-amber-500 focus:outline-none"
                  onChange={(e) => setPrefs({ ...prefs, dietary_notes: e.target.value })}
                  placeholder="e.g. Lactose intolerant, Oat milk preference"
                  type="text"
                  value={prefs.dietary_notes}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Favorite Drink Notes</label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs focus:border-amber-500 focus:outline-none"
                  onChange={(e) => setPrefs({ ...prefs, favorite_item_notes: e.target.value })}
                  placeholder="e.g. Spanish Latte, extra shot"
                  type="text"
                  value={prefs.favorite_item_notes}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  checked={prefs.marketing_consent}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                  id="marketing-consent"
                  onChange={(e) => setPrefs({ ...prefs, marketing_consent: e.target.checked })}
                  type="checkbox"
                />
                <label className="text-xs font-medium text-stone-700" htmlFor="marketing-consent">
                  Customer has given explicit consent for marketing promotions
                </label>
              </div>

              <button
                className="rounded-xl bg-amber-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-900 disabled:opacity-50 cursor-pointer"
                disabled={isSavingPrefs}
                type="submit"
              >
                {isSavingPrefs ? "Saving..." : "Save Preferences"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-base font-bold text-stone-900">{value}</p>
    </div>
  );
}
