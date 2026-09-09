import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";

const INITIAL_FORM = {
  identifier: "",
  password: "",
};

function AuthForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [authenticationError, setAuthenticationError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setAuthenticationError("");

    if (errors[name]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [name]: "",
      }));
    }
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.identifier.trim()) {
      nextErrors.identifier = "Enter your username or email.";
    }

    if (!form.password) {
      nextErrors.password = "Enter your password.";
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      setAuthenticationError("");

      await login({
        identifier: form.identifier.trim(),
        password: form.password,
      });

      setForm(INITIAL_FORM);

      const destination =
        location.state?.from?.pathname ?? "/overview";

      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      setForm((currentForm) => ({
        ...currentForm,
        password: "",
      }));

      if (error.response?.status === 401) {
        setAuthenticationError(
          "The sign-in details you entered are incorrect.",
        );
      } else if (error.code === "ECONNABORTED") {
        setAuthenticationError(
          "The server took too long to respond. Please try again.",
        );
      } else if (!error.response) {
        setAuthenticationError(
          "We could not connect to the server.",
        );
      } else {
        setAuthenticationError(
          "We could not sign you in. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 flex items-center justify-center font-sans">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Left Branding Panel */}
        <div className="hidden w-1/2 bg-amber-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
              <span>☕</span>
              <span>LDRN&apos;s Coffee</span>
            </div>

            <h1 className="mt-8 max-w-md text-4xl font-bold leading-tight sm:text-5xl">
              Run your coffee shop with clarity.
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-amber-100">
              Manage orders, menu catalog, inventory, and daily store operations from one workspace.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-amber-200">
            <span>Coffee Shop Management System</span>
            <Link to="/" className="font-semibold text-amber-300 hover:underline">
              ← View Storefront
            </Link>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex w-full items-center justify-center p-8 sm:p-12 lg:w-1/2 bg-white">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <span>☕</span>
                <span>LDRN&apos;s Coffee</span>
              </div>
              <Link to="/" className="text-xs font-semibold text-amber-900 hover:underline">
                ← Storefront
              </Link>
            </div>

            <h2 className="text-3xl font-bold text-stone-900">Welcome back</h2>

            <p className="mt-2 text-xs text-stone-600">
              Sign in using your staff account.
            </p>

            {authenticationError && (
              <div
                className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                role="alert"
              >
                {authenticationError}
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-stone-800 uppercase tracking-wider"
                  htmlFor="identifier"
                >
                  Username or email
                </label>

                <input
                  aria-describedby={
                    errors.identifier ? "identifier-error" : undefined
                  }
                  aria-invalid={Boolean(errors.identifier)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  id="identifier"
                  name="identifier"
                  onChange={handleChange}
                  placeholder="Enter your username or email"
                  type="text"
                  value={form.identifier}
                />

                {errors.identifier && (
                  <p
                    className="mt-1.5 text-xs text-red-600"
                    id="identifier-error"
                    role="alert"
                  >
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-stone-800 uppercase tracking-wider"
                  htmlFor="password"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    aria-invalid={Boolean(errors.password)}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 pr-20 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                    id="password"
                    name="password"
                    onChange={handleChange}
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                  />

                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-800 hover:text-amber-950"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {errors.password && (
                  <p
                    className="mt-1.5 text-xs text-red-600"
                    id="password-error"
                    role="alert"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                className="w-full rounded-xl bg-amber-900 px-4 py-3 text-xs font-bold text-white uppercase tracking-wider transition hover:bg-amber-950 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Signing in..." : "Sign in to Workspace"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-stone-500">
              Contact an administrator if you cannot access your account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AuthForm;
