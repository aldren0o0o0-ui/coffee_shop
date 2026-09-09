import { useEffect, useMemo, useState } from "react";
import {
  approvePurchaseRequest,
  createPurchaseRequest,
  fetchPurchaseRequests,
  receivePurchaseRequest,
  rejectPurchaseRequest,
  submitPurchaseRequest,
} from "../api/procurementApi";
import { fetchInventoryOptions } from "../../inventory/api/inventoryApi";
import { useAuth } from "../../auth/context/useAuth";
import { formatCurrency } from "../../payments/utils/currency";

export default function PurchasingPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Rejection prompt state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // New Request Form State
  const [expectedDate, setExpectedDate] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [lineItems, setLineItems] = useState([
    { inventory_item_id: "", quantity: "1" },
  ]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const userRoles = useMemo(() => {
    return new Set((user?.roles || []).map((r) => r.role_name.toLowerCase()));
  }, [user]);

  const canApproveOrReject = userRoles.has("owner") || userRoles.has("manager");

  function showBanner(msg, isSuccess = true) {
    if (isSuccess) {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(""), 4000);
    } else {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  }

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [reqData, invOptions] = await Promise.all([
        fetchPurchaseRequests(),
        fetchInventoryOptions(),
      ]);
      setRequests(reqData);
      setInventoryOptions(invOptions);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to load purchasing requests."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        String(req.purchase_request_id).includes(searchQuery) ||
        (req.notes && req.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.created_by_user &&
          `${req.created_by_user.first_name} ${req.created_by_user.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      return req.request_status.toLowerCase() === activeTab.toLowerCase();
    });
  }, [requests, searchQuery, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: requests.length, draft: 0, submitted: 0, approved: 0, received: 0, rejected: 0 };
    for (const r of requests) {
      const s = r.request_status.toLowerCase();
      if (counts[s] !== undefined) {
        counts[s]++;
      }
    }
    return counts;
  }, [requests]);

  // Open Create Modal
  function openCreateModal() {
    const todayPlusThree = new Date();
    todayPlusThree.setDate(todayPlusThree.getDate() + 3);
    setExpectedDate(todayPlusThree.toISOString().split("T")[0]);
    setRequestNotes("");
    setLineItems([
      {
        inventory_item_id: inventoryOptions[0]?.inventory_item_id || "",
        quantity: "1",
      },
    ]);
    setIsCreateModalOpen(true);
  }

  function handleLineItemChange(index, field, value) {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        inventory_item_id: inventoryOptions[0]?.inventory_item_id || "",
        quantity: "1",
      },
    ]);
  }

  function removeLineItem(index) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleCreateSubmit(e, andSubmit = false) {
    e.preventDefault();

    const validItems = lineItems
      .filter((li) => li.inventory_item_id && parseFloat(li.quantity) > 0)
      .map((li) => ({
        inventory_item_id: parseInt(li.inventory_item_id),
        quantity_requested: parseFloat(li.quantity),
      }));

    if (validItems.length === 0) {
      showBanner("Please add at least one valid line item with quantity > 0.", false);
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const created = await createPurchaseRequest({
        expected_delivery_date: expectedDate ? new Date(expectedDate).toISOString() : null,
        notes: requestNotes.trim() || null,
        items: validItems,
      });

      if (andSubmit) {
        await submitPurchaseRequest(created.purchase_request_id);
        showBanner(`Purchase Request #${created.purchase_request_id} created and submitted for approval!`);
      } else {
        showBanner(`Draft Purchase Request #${created.purchase_request_id} saved.`);
      }

      setIsCreateModalOpen(false);
      loadData();
    } catch (err) {
      showBanner(
        err.response?.data?.detail || "Failed to create purchase request.",
        false
      );
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  // Open Details Modal
  function openDetailModal(request) {
    setSelectedRequest(request);
    setIsRejecting(false);
    setRejectionReason("");
    setIsDetailModalOpen(true);
  }

  // Action Handlers
  async function handleSubmitDraft(requestId) {
    setIsProcessingAction(true);
    try {
      await submitPurchaseRequest(requestId);
      showBanner(`Purchase Request #${requestId} submitted for approval.`);
      setIsDetailModalOpen(false);
      loadData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to submit request.", false);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleApprove(requestId) {
    setIsProcessingAction(true);
    try {
      await approvePurchaseRequest(requestId);
      showBanner(`Purchase Request #${requestId} approved!`);
      setIsDetailModalOpen(false);
      loadData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to approve request.", false);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleReject(requestId) {
    if (!rejectionReason.trim()) {
      showBanner("Please provide a reason for rejecting this purchase request.", false);
      return;
    }

    setIsProcessingAction(true);
    try {
      await rejectPurchaseRequest(requestId, rejectionReason.trim());
      showBanner(`Purchase Request #${requestId} rejected.`);
      setIsDetailModalOpen(false);
      loadData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to reject request.", false);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleReceive(requestId) {
    setIsProcessingAction(true);
    try {
      await receivePurchaseRequest(requestId);
      showBanner(`Purchase #${requestId} marked as received. Stock was updated automatically!`);
      setIsDetailModalOpen(false);
      loadData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to receive delivery.", false);
    } finally {
      setIsProcessingAction(false);
    }
  }

  function getStatusBadge(status) {
    switch (status.toLowerCase()) {
      case "draft":
        return "bg-stone-100 text-stone-700 border-stone-200";
      case "submitted":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "approved":
        return "bg-blue-100 text-blue-900 border-blue-200";
      case "received":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "rejected":
        return "bg-rose-100 text-rose-900 border-rose-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm transition">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm transition">
          {errorMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-amber-950">
            Purchasing & Supplies
          </h2>
          <p className="text-sm text-stone-500">
            Create supply orders, approve procurement, and receive inventory restocks.
          </p>
        </div>

        <button
          className="flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-900"
          onClick={openCreateModal}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>New Purchase Request</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xs">
          {[
            { id: "all", label: `All (${tabCounts.all})` },
            { id: "draft", label: `Drafts (${tabCounts.draft})` },
            { id: "submitted", label: `Pending Approval (${tabCounts.submitted})` },
            { id: "approved", label: `Approved (${tabCounts.approved})` },
            { id: "received", label: `Received (${tabCounts.received})` },
            { id: "rejected", label: `Rejected (${tabCounts.rejected})` },
          ].map((tab) => (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-amber-900 text-white shadow-xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 placeholder-stone-400 shadow-xs focus:border-amber-500 focus:outline-none"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PR# or notes..."
            type="text"
            value={searchQuery}
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Requests Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
            <p className="mt-3 text-xs text-stone-500">Loading purchase requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-stone-700">No purchase requests found.</p>
            <p className="mt-1 text-xs text-stone-500">
              {searchQuery ? "Try a different search query." : "Click 'New Purchase Request' to request store supplies."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 bg-stone-50/80 font-semibold uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Items Summary</th>
                  <th className="px-4 py-3">Estimated Total</th>
                  <th className="px-4 py-3">Delivery Date</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredRequests.map((req) => {
                  const itemsCount = req.items?.length || 0;
                  const firstItem = req.items?.[0]?.inventory_item?.item_name || "Items";
                  const summary =
                    itemsCount > 1
                      ? `${firstItem} + ${itemsCount - 1} more`
                      : firstItem;

                  return (
                    <tr className="transition hover:bg-stone-50/60" key={req.purchase_request_id}>
                      <td className="px-4 py-3 font-bold text-amber-950">
                        #PR-{req.purchase_request_id.toString().padStart(4, "0")}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadge(
                            req.request_status
                          )}`}
                        >
                          {req.request_status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{summary}</p>
                        {req.notes && (
                          <p className="truncate text-[11px] text-stone-400 max-w-xs">
                            {req.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 font-bold text-stone-900">
                        {formatCurrency(req.total_estimated_amount || 0)}
                      </td>

                      <td className="px-4 py-3 text-stone-600">
                        {req.expected_delivery_date
                          ? new Date(req.expected_delivery_date).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Unscheduled"}
                      </td>

                      <td className="px-4 py-3 text-stone-600">
                        {req.created_by_user
                          ? `${req.created_by_user.first_name} ${req.created_by_user.last_name}`
                          : "Staff"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-700 shadow-xs transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950"
                            onClick={() => openDetailModal(req)}
                            type="button"
                          >
                            Details
                          </button>

                          {req.request_status.toLowerCase() === "draft" && (
                            <button
                              className="rounded-lg bg-amber-900 px-2.5 py-1 font-semibold text-white shadow-xs transition hover:bg-amber-950"
                              onClick={() => handleSubmitDraft(req.purchase_request_id)}
                              type="button"
                            >
                              Submit
                            </button>
                          )}

                          {req.request_status.toLowerCase() === "approved" && (
                            <button
                              className="rounded-lg bg-emerald-700 px-2.5 py-1 font-semibold text-white shadow-xs transition hover:bg-emerald-800"
                              onClick={() => handleReceive(req.purchase_request_id)}
                              type="button"
                            >
                              Receive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Create Purchase Request */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  New Purchase Request
                </h3>
                <p className="text-xs text-stone-500">
                  Select ingredients and items to requisition from suppliers.
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => setIsCreateModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <form
              className="flex-1 overflow-y-auto py-4 space-y-4"
              onSubmit={(e) => handleCreateSubmit(e, false)}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Expected Delivery Date
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    onChange={(e) => setExpectedDate(e.target.value)}
                    type="date"
                    value={expectedDate}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Supplier / Order Notes
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="e.g. Weekly beans restock"
                    type="text"
                    value={requestNotes}
                  />
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700">
                    Required Supplies ({lineItems.length})
                  </label>
                  <button
                    className="text-xs font-semibold text-amber-900 hover:underline"
                    onClick={addLineItem}
                    type="button"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {lineItems.map((item, idx) => (
                    <div
                      className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/50 p-2.5"
                      key={idx}
                    >
                      <div className="flex-1">
                        <select
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                          onChange={(e) =>
                            handleLineItemChange(
                              idx,
                              "inventory_item_id",
                              e.target.value
                            )
                          }
                          required
                          value={item.inventory_item_id}
                        >
                          <option value="">Select ingredient / item...</option>
                          {inventoryOptions.map((opt) => (
                            <option
                              key={opt.inventory_item_id}
                              value={opt.inventory_item_id}
                            >
                              {opt.item_name} ({opt.unit_of_measure})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs font-semibold text-stone-900 focus:border-amber-500 focus:outline-none"
                          min="0.1"
                          onChange={(e) =>
                            handleLineItemChange(idx, "quantity", e.target.value)
                          }
                          placeholder="Qty"
                          required
                          step="any"
                          type="number"
                          value={item.quantity}
                        />
                      </div>

                      {lineItems.length > 1 && (
                        <button
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-rose-600"
                          onClick={() => removeLineItem(idx)}
                          title="Remove item"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                <button
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-amber-800 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                    disabled={isSubmittingCreate}
                    type="submit"
                  >
                    {isSubmittingCreate ? "Saving…" : "Save as Draft"}
                  </button>
                  <button
                    className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-950 disabled:opacity-50"
                    disabled={isSubmittingCreate}
                    onClick={(e) => handleCreateSubmit(e, true)}
                    type="button"
                  >
                    {isSubmittingCreate ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Request Details & Actions */}
      {isDetailModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-amber-950">
                    Purchase Request #{selectedRequest.purchase_request_id}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${getStatusBadge(
                      selectedRequest.request_status
                    )}`}
                  >
                    {selectedRequest.request_status}
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Requested by:{" "}
                  {selectedRequest.created_by_user
                    ? `${selectedRequest.created_by_user.first_name} ${selectedRequest.created_by_user.last_name}`
                    : "Staff"}
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => setIsDetailModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 text-stone-700">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-stone-400">Created Date</p>
                  <p className="font-semibold text-stone-900">
                    {new Date(selectedRequest.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-stone-400">Expected Delivery</p>
                  <p className="font-semibold text-stone-900">
                    {selectedRequest.expected_delivery_date
                      ? new Date(selectedRequest.expected_delivery_date).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Unscheduled"}
                  </p>
                </div>
                {selectedRequest.notes && (
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Notes</p>
                    <p className="text-stone-800">{selectedRequest.notes}</p>
                  </div>
                )}
                {selectedRequest.rejection_reason && (
                  <div className="col-span-2 rounded-lg bg-rose-50 p-2 text-rose-800 border border-rose-200">
                    <p className="text-[10px] uppercase font-bold">Rejection Reason</p>
                    <p>{selectedRequest.rejection_reason}</p>
                  </div>
                )}
              </div>

              {/* Line Items List */}
              <div>
                <p className="font-semibold text-stone-900 mb-2">Requested Supplies</p>
                <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                  {selectedRequest.items?.map((item) => (
                    <div
                      className="flex items-center justify-between p-2.5"
                      key={item.purchase_request_item_id}
                    >
                      <div>
                        <p className="font-bold text-stone-900">
                          {item.inventory_item?.item_name || `Item #${item.inventory_item_id}`}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {parseFloat(item.quantity_requested)} {item.inventory_item?.unit_of_measure} @ {formatCurrency(item.unit_cost_snapshot)}
                        </p>
                      </div>
                      <p className="font-bold text-stone-900">
                        {formatCurrency(item.total_cost || parseFloat(item.quantity_requested) * parseFloat(item.unit_cost_snapshot))}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-stone-50/80 p-2.5 font-bold text-stone-900">
                    <span>Estimated Total:</span>
                    <span className="text-sm text-amber-950">
                      {formatCurrency(selectedRequest.total_estimated_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rejection input prompt */}
              {isRejecting && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <label className="block font-semibold text-rose-900">
                    State reason for rejection:
                  </label>
                  <input
                    className="w-full rounded-lg border border-rose-300 bg-white p-2 text-xs text-stone-900 focus:outline-none"
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Budget exceeded or supplier discontinued item"
                    type="text"
                    value={rejectionReason}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-lg px-3 py-1 font-semibold text-stone-600 hover:bg-stone-200/50"
                      onClick={() => setIsRejecting(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      disabled={isProcessingAction}
                      onClick={() => handleReject(selectedRequest.purchase_request_id)}
                      type="button"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
              <button
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => setIsDetailModalOpen(false)}
                type="button"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {selectedRequest.request_status.toLowerCase() === "draft" && (
                  <button
                    className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-50"
                    disabled={isProcessingAction}
                    onClick={() => handleSubmitDraft(selectedRequest.purchase_request_id)}
                    type="button"
                  >
                    Submit for Approval
                  </button>
                )}

                {selectedRequest.request_status.toLowerCase() === "submitted" && canApproveOrReject && !isRejecting && (
                  <>
                    <button
                      className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                      onClick={() => setIsRejecting(true)}
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                      disabled={isProcessingAction}
                      onClick={() => handleApprove(selectedRequest.purchase_request_id)}
                      type="button"
                    >
                      Approve Order
                    </button>
                  </>
                )}

                {selectedRequest.request_status.toLowerCase() === "approved" && (
                  <button
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    disabled={isProcessingAction}
                    onClick={() => handleReceive(selectedRequest.purchase_request_id)}
                    type="button"
                  >
                    Receive Delivery
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
