import { useEffect, useId, useState } from "react";
import { useAuth } from "../context/useAuth";

export default function ChangePasswordModal({ isOpen, onClose, isForced = false }) {
  const { changePassword, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleId = useId();
  const descId = useId();

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccessMessage("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle escape key only if not forced
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && isOpen && !isForced && onClose) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isForced, onClose]);

  if (!isOpen) return null;

  // Password strength calculation
  const hasMinLength = newPassword.length >= 8;
  const hasMixedChars = /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  let strengthScore = 0;
  if (hasMinLength) strengthScore += 1;
  if (hasMixedChars) strengthScore += 1;
  if (newPassword.length >= 12 || /[^A-Za-z0-9]/.test(newPassword)) strengthScore += 1;

  const strengthLabels = ["Weak", "Fair", "Strong"];
  const strengthColors = ["bg-rose-500", "bg-amber-500", "bg-emerald-600"];
  const strengthTextColor = ["text-rose-600", "text-amber-600", "text-emerald-700"];

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }

    if (!hasMinLength) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Your new password must be different from your current password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccessMessage("Password updated successfully! Your account is now secured.");
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.status === 400) {
        setError("Current password is incorrect or new password does not meet requirements.");
      } else {
        setError("Unable to update password. Please check your network and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-describedby={descId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/70 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      role="dialog"
    >
      {/* Background click handler only if voluntary */}
      {!isForced && (
        <button
          aria-label="Close dialog overlay"
          className="fixed inset-0 h-full w-full cursor-default bg-transparent"
          onClick={onClose}
          type="button"
        />
      )}

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl sm:p-8">
        {/* Header decoration bar */}
        <div className={`absolute left-0 right-0 top-0 h-2 ${isForced ? "bg-amber-600" : "bg-stone-800"}`} />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isForced ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-900"}`}>
              {isForced ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 sm:text-2xl" id={titleId}>
                {isForced ? "Welcome! Set Your Password" : "Change Password"}
              </h2>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-amber-800">
                {user?.username ? `@${user.username}` : "Staff Account"} • {user?.roles?.map((r) => r.role_name).join(", ")}
              </p>
            </div>
          </div>

          {!isForced && onClose && (
            <button
              aria-label="Close dialog"
              className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              onClick={onClose}
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Prompt Description */}
        <p className="mt-4 text-sm leading-relaxed text-stone-600" id={descId}>
          {isForced
            ? "Your staff account was created with a temporary password. Before accessing your coffee shop workspace, please choose a permanent, private password."
            : "Update your password to keep your account safe and secure."}
        </p>

        {/* Status Alerts */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800" role="alert">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800" role="status">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Password Form */}
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {/* Current / Temporary Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-700" htmlFor="current-password-input">
              {isForced ? "Temporary Password Given" : "Current Password"}
            </label>
            <div className="relative">
              <input
                autoComplete="current-password"
                className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-4 py-2.5 pr-11 text-sm text-stone-900 transition placeholder:text-stone-400 focus:border-amber-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-100"
                id="current-password-input"
                name="currentPassword"
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={isForced ? "Enter temporary password" : "Enter current password"}
                required
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
              />
              <button
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 hover:text-stone-800"
                onClick={() => setShowCurrent(!showCurrent)}
                type="button"
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-700" htmlFor="new-password-input">
              New Password
            </label>
            <div className="relative">
              <input
                autoComplete="new-password"
                className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-4 py-2.5 pr-11 text-sm text-stone-900 transition placeholder:text-stone-400 focus:border-amber-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-100"
                id="new-password-input"
                name="newPassword"
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                type={showNew ? "text" : "password"}
                value={newPassword}
              />
              <button
                aria-label={showNew ? "Hide new password" : "Show new password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 hover:text-stone-800"
                onClick={() => setShowNew(!showNew)}
                type="button"
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>

            {/* Strength Meter Bar */}
            {newPassword.length > 0 && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Password strength</span>
                  <span className={`font-semibold ${strengthScore > 0 ? strengthTextColor[Math.min(strengthScore - 1, 2)] : "text-stone-400"}`}>
                    {strengthScore > 0 ? strengthLabels[Math.min(strengthScore - 1, 2)] : "Too short"}
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-stone-200">
                  <div className={`h-full flex-1 transition-all ${strengthScore >= 1 ? strengthColors[0] : "bg-transparent"}`} />
                  <div className={`h-full flex-1 transition-all ${strengthScore >= 2 ? strengthColors[1] : "bg-transparent"}`} />
                  <div className={`h-full flex-1 transition-all ${strengthScore >= 3 ? strengthColors[2] : "bg-transparent"}`} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-700" htmlFor="confirm-password-input">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                autoComplete="new-password"
                className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-sm text-stone-900 transition placeholder:text-stone-400 focus:outline-none focus:ring-4 ${
                  confirmPassword && !passwordsMatch
                    ? "border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100"
                    : "border-stone-300 bg-stone-50/50 focus:border-amber-700 focus:bg-white focus:ring-amber-100"
                }`}
                id="confirm-password-input"
                name="confirmPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 hover:text-stone-800"
                onClick={() => setShowConfirm(!showConfirm)}
                type="button"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-rose-600">Passwords do not match.</p>
            )}
          </div>

          {/* Real-time Checklist */}
          <div className="rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
            <p className="font-semibold text-stone-800">Password Checklist:</p>
            <ul className="mt-1.5 space-y-1">
              <li className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-700 font-medium" : "text-stone-500"}`}>
                <span>{hasMinLength ? "✓" : "○"}</span> At least 8 characters
              </li>
              <li className={`flex items-center gap-1.5 ${hasMixedChars ? "text-emerald-700 font-medium" : "text-stone-500"}`}>
                <span>{hasMixedChars ? "✓" : "○"}</span> Letters and numbers
              </li>
              <li className={`flex items-center gap-1.5 ${passwordsMatch ? "text-emerald-700 font-medium" : "text-stone-500"}`}>
                <span>{passwordsMatch ? "✓" : "○"}</span> Confirmation matches new password
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            {!isForced && onClose && (
              <button
                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
                disabled={isSubmitting}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
            )}

            <button
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-950 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !hasMinLength || !passwordsMatch || !currentPassword}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving password…</span>
                </>
              ) : isForced ? (
                "Set Password & Enter Workspace"
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
