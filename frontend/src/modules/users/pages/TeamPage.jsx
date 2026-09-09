import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createTeamMember,
  fetchTeamMembers,
} from "../api/teamApi";


const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  phone_number: "",
  role: "cashier",
};


const STAFF_ROLES = [
  {
    value: "manager",
    label: "Manager",
    description:
      "Manages orders, menu, stock, and reports.",
  },
  {
    value: "cashier",
    label: "Cashier",
    description:
      "Takes customer orders and receives payments.",
  },
  {
    value: "barista",
    label: "Barista",
    description:
      "Prepares drinks and updates order progress.",
  },
  {
    value: "inventory_staff",
    label: "Stock assistant",
    description:
      "Monitors supplies and helps manage purchasing.",
  },
];


function getErrorMessage(error) {
  if (!error.response) {
    return "We could not connect to the server.";
  }

  if (error.response.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (error.response.status === 403) {
    return "Only the Owner can manage the team.";
  }

  if (error.response.status === 409) {
    return (
      error.response.data?.detail ??
      "That username or email address is already in use."
    );
  }

  if (error.response.status === 422) {
    return "Check the information and try again.";
  }

  return "Something went wrong. Please try again.";
}


function TeamMemberCard({ member }) {
  const displayRoles = member.roles
    .map((role) => role.role_name)
    .join(", ");

  const initials = [
    member.first_name,
    member.last_name,
  ]
    .map((name) => name?.[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-950">
          {initials}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-stone-900">
              {member.first_name} {member.last_name}
            </h3>

            <span
              className={[
                "rounded-full px-2 py-1 text-xs font-semibold",
                member.is_active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-stone-200 text-stone-600",
              ].join(" ")}
            >
              {member.is_active
                ? "Has access"
                : "Access paused"}
            </span>
          </div>

          <p className="mt-1 truncate text-sm text-stone-600">
            {member.email}
          </p>

          <p className="mt-1 text-sm font-medium text-amber-900">
            {displayRoles || "No responsibility assigned"}
          </p>
        </div>
      </div>

      <div className="sm:text-right">
        <p className="text-sm text-stone-500">
          Sign-in name
        </p>

        <p className="font-medium text-stone-800">
          {member.username}
        </p>

        {member.must_change_password && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Waiting for password change
          </p>
        )}
      </div>
    </article>
  );
}


function TemporaryCredentials({
  credentials,
  onClose,
}) {
  const [copiedField, setCopiedField] =
    useState("");

  async function copyValue(field, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setCopiedField("");
    }
  }

  return (
    <div
      aria-labelledby="credentials-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
      role="dialog"
    >
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
          ✓
        </div>

        <h2
          className="mt-5 text-2xl font-bold text-stone-900"
          id="credentials-title"
        >
          Team member added
        </h2>

        <p className="mt-2 text-stone-600">
          Give these sign-in details directly to{" "}
          {credentials.first_name}. The temporary
          password will disappear when you close this
          window.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl bg-stone-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Username
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <code className="break-all font-semibold text-stone-900">
                {credentials.username}
              </code>

              <button
                className="shrink-0 text-sm font-semibold text-amber-900"
                onClick={() =>
                  copyValue(
                    "username",
                    credentials.username,
                  )
                }
                type="button"
              >
                {copiedField === "username"
                  ? "Copied"
                  : "Copy"}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Temporary password
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <code className="break-all font-semibold text-amber-950">
                {credentials.temporary_password}
              </code>

              <button
                className="shrink-0 text-sm font-semibold text-amber-900"
                onClick={() =>
                  copyValue(
                    "password",
                    credentials.temporary_password,
                  )
                }
                type="button"
              >
                {copiedField === "password"
                  ? "Copied"
                  : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Share these details privately. Do not send
          the temporary password in a public group chat.
        </div>

        <button
          className="mt-6 w-full rounded-xl bg-amber-900 px-4 py-3 font-semibold text-white hover:bg-amber-950"
          onClick={onClose}
          type="button"
        >
          I have saved the sign-in details
        </button>
      </section>
    </div>
  );
}


function AddTeamMemberDialog({
  isOpen,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeWithEscape(event) {
      if (
        event.key === "Escape"
        && !isSubmitting
      ) {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        closeWithEscape,
      );
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const createdMember = await createTeamMember({
        ...form,
        phone_number:
          form.phone_number.trim() || null,
      });

      setForm(INITIAL_FORM);
      onCreated(createdMember);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="add-member-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
      role="dialog"
    >
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 flex items-start justify-between border-b border-stone-200 bg-white p-6">
          <div>
            <h2
              className="text-2xl font-bold text-stone-900"
              id="add-member-title"
            >
              Add a team member
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              Create their sign-in account and choose
              what they will work on.
            </p>
          </div>

          <button
            aria-label="Close"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>

        <form
          className="space-y-8 p-6"
          onSubmit={handleSubmit}
        >
          {errorMessage && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <fieldset>
            <legend className="font-bold text-stone-900">
              Personal details
            </legend>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-stone-700">
                First name
                <input
                  autoComplete="given-name"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  maxLength={50}
                  name="first_name"
                  onChange={handleChange}
                  required
                  value={form.first_name}
                />
              </label>

              <label className="text-sm font-medium text-stone-700">
                Last name
                <input
                  autoComplete="family-name"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  maxLength={50}
                  name="last_name"
                  onChange={handleChange}
                  required
                  value={form.last_name}
                />
              </label>

              <label className="text-sm font-medium text-stone-700 sm:col-span-2">
                Email address
                <input
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  maxLength={100}
                  name="email"
                  onChange={handleChange}
                  required
                  type="email"
                  value={form.email}
                />
              </label>

              <label className="text-sm font-medium text-stone-700">
                Username
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  maxLength={50}
                  minLength={3}
                  name="username"
                  onChange={handleChange}
                  pattern="[a-zA-Z0-9._-]+"
                  required
                  value={form.username}
                />

                <span className="mt-1 block text-xs font-normal text-stone-500">
                  Letters, numbers, periods, underscores,
                  or hyphens.
                </span>
              </label>

              <label className="text-sm font-medium text-stone-700">
                Mobile number{" "}
                <span className="font-normal text-stone-400">
                  (optional)
                </span>
                <input
                  autoComplete="tel"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  maxLength={20}
                  name="phone_number"
                  onChange={handleChange}
                  type="tel"
                  value={form.phone_number}
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-bold text-stone-900">
              What will they work on?
            </legend>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {STAFF_ROLES.map((role) => (
                <label
                  className={[
                    "cursor-pointer rounded-xl border p-4 transition",
                    form.role === role.value
                      ? "border-amber-700 bg-amber-50 ring-2 ring-amber-100"
                      : "border-stone-200 hover:border-stone-300",
                  ].join(" ")}
                  key={role.value}
                >
                  <div className="flex gap-3">
                    <input
                      checked={form.role === role.value}
                      className="mt-1 accent-amber-900"
                      name="role"
                      onChange={handleChange}
                      type="radio"
                      value={role.value}
                    />

                    <div>
                      <p className="font-semibold text-stone-900">
                        {role.label}
                      </p>

                      <p className="mt-1 text-sm text-stone-600">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">
            A secure temporary password will be created
            automatically. The team member will need to
            replace it after signing in.
          </div>

          <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-stone-300 px-5 py-3 font-semibold text-stone-700 hover:bg-stone-100"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            <button
              className="rounded-xl bg-amber-900 px-5 py-3 font-semibold text-white hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Adding team member…"
                : "Add team member"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}


export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isAddingMember, setIsAddingMember] =
    useState(false);
  const [
    temporaryCredentials,
    setTemporaryCredentials,
  ] = useState(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  function handleCreated(createdMember) {
    const {
      temporary_password,
      ...memberWithoutPassword
    } = createdMember;

    setMembers((current) => [
      memberWithoutPassword,
      ...current,
    ]);

    setIsAddingMember(false);

    setTemporaryCredentials({
      first_name: createdMember.first_name,
      username: createdMember.username,
      temporary_password,
    });
  }

  const activeCount = members.filter(
    (member) => member.is_active,
  ).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">
            Your team
          </h2>

          <p className="mt-1 text-stone-600">
            {activeCount}{" "}
            {activeCount === 1
              ? "person has"
              : "people have"}{" "}
            access to the workspace.
          </p>
        </div>

        <button
          className="rounded-xl bg-amber-900 px-5 py-3 font-semibold text-white hover:bg-amber-950"
          onClick={() => setIsAddingMember(true)}
          type="button"
        >
          Add team member
        </button>
      </section>

      {isLoading && (
        <section
          className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-600"
          role="status"
        >
          Loading your team…
        </section>
      )}

      {!isLoading && loadError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{loadError}</p>

          <button
            className="mt-4 font-semibold text-red-800"
            onClick={loadMembers}
            type="button"
          >
            Try again
          </button>
        </section>
      )}

      {!isLoading
        && !loadError
        && members.length === 0 && (
          <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <h3 className="font-bold text-stone-900">
              No team members yet
            </h3>

            <p className="mt-2 text-stone-600">
              Add the first person who will help run
              your shop.
            </p>
          </section>
        )}

      {!isLoading
        && !loadError
        && members.length > 0 && (
          <section className="space-y-3">
            {members.map((member) => (
              <TeamMemberCard
                key={member.user_id}
                member={member}
              />
            ))}
          </section>
        )}

      <AddTeamMemberDialog
        isOpen={isAddingMember}
        onClose={() => setIsAddingMember(false)}
        onCreated={handleCreated}
      />

      {temporaryCredentials && (
        <TemporaryCredentials
          credentials={temporaryCredentials}
          onClose={() =>
            setTemporaryCredentials(null)
          }
        />
      )}
    </div>
  );
}
