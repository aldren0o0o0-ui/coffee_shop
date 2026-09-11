import { useBranch } from "../context/useBranch";
import { useAuth } from "../../auth/context/useAuth";

export default function BranchSelector() {
  const { user } = useAuth();
  const { branches, selectedBranchId, selectBranch } = useBranch();

  const userRoles = (user?.roles || []).map((r) => r.role_name.toLowerCase());
  const isOwnerOrManager = userRoles.some((r) => r === "owner" || r === "manager");

  if (!isOwnerOrManager || branches.length <= 1) {
    return (
      <div className="hidden items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 sm:flex">
        <span>📍</span>
        <span>{branches[0]?.name || "Main Branch"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-400">📍</span>
      <select
        value={selectedBranchId}
        onChange={(e) => selectBranch(e.target.value)}
        className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-bold text-stone-800 shadow-xs outline-none hover:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
        aria-label="Select store branch"
      >
        <option value="all">All Branches (Consolidated)</option>
        {branches.map((b) => (
          <option key={b.branch_id} value={b.branch_id}>
            {b.name} ({b.code})
          </option>
        ))}
      </select>
    </div>
  );
}
