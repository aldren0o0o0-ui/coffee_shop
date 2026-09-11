import { useEffect, useState } from "react";
import { BranchContext } from "./branchContext";

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem("ldrn_selected_branch_id") || "all";
  });
  const [isLoading, setIsLoading] = useState(true);

  async function loadBranches() {
    try {
      const res = await fetch("/api/v1/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.warn("Failed to load branches:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  function selectBranch(id) {
    setSelectedBranchId(id);
    localStorage.setItem("ldrn_selected_branch_id", id);
  }

  const currentBranch = branches.find((b) => String(b.branch_id) === String(selectedBranchId)) || null;

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranchId,
        currentBranch,
        selectBranch,
        isLoading,
        reloadBranches: loadBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}
