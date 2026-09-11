import { useContext } from "react";
import { BranchContext } from "./branchContext";

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    return {
      branches: [],
      selectedBranchId: "all",
      currentBranch: null,
      selectBranch: () => {},
      isLoading: false,
    };
  }
  return context;
}
