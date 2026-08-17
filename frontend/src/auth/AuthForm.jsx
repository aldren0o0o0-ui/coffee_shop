import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "./AuthContext";

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
        location.state?.from?.pathname ?? "/";

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
    <main className="min-h-screen bg-stone-100 px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="hidden w-1/2 bg-amber-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              ldrn's coffee
            </p>

            <h1 className="mt-6 max-w-md text-5xl font-bold leading-tight">
              Run your coffee shop with clarity.
            </h1>

            <p className="mt-6 max-w-md text-lg text-amber-100">
              Manage orders, products, inventory, and daily operations from one
              workspace.
            </p>
          </div>

          <p className="text-sm text-amber-200">
            Coffee Shop Management System
          </p>
        </div>

        <div className="flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <p className="font-semibold uppercase tracking-[0.25em] text-amber-900">
                BrewFlow
              </p>
            </div>

            <h2 className="text-3xl font-bold text-stone-900">Welcome back</h2>

            <p className="mt-2 text-stone-600">
              Sign in using your staff account.
            </p>

            {authenticationError && (
              <div
                className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {authenticationError}
              </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-stone-800"
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
                  className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                  id="identifier"
                  name="identifier"
                  onChange={handleChange}
                  placeholder="Enter your username or email"
                  type="text"
                  value={form.identifier}
                />

                {errors.identifier && (
                  <p
                    className="mt-2 text-sm text-red-600"
                    id="identifier-error"
                    role="alert"
                  >
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium text-stone-800"
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
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 pr-20 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                    id="password"
                    name="password"
                    onChange={handleChange}
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                  />

                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-amber-800 hover:text-amber-950"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {errors.password && (
                  <p
                    className="mt-2 text-sm text-red-600"
                    id="password-error"
                    role="alert"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                className="w-full rounded-xl bg-amber-900 px-4 py-3 font-semibold text-white transition hover:bg-amber-950 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-stone-500">
              Contact an administrator if you cannot access your account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AuthForm;