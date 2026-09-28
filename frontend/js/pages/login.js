/* Login page. Sends credentials to POST /auth/login, then reads the real role
   from GET /auth/me before routing anywhere. */

const LoginPage = {
  async render({ outlet, query }) {
    outlet.innerHTML = `
      <div class="auth-wrapper">
        <div class="card auth-card border-0 shadow-sm">
          <div class="card-body p-4 p-md-5">
            <div class="text-center mb-4">
              <div class="brand-mark mx-auto mb-3"><i class="bi bi-headset"></i></div>
              <h1 class="h4 mb-1">AI Customer Support</h1>
              <p class="text-body-secondary small mb-0">Sign in to your account</p>
            </div>

            <div class="alert alert-danger d-none" data-error role="alert"></div>

            <form novalidate>
              <div class="mb-3">
                <label for="login-email" class="form-label">Email</label>
                <input type="email" id="login-email" name="email" class="form-control"
                       autocomplete="email" required placeholder="you@example.com">
              </div>
              <div class="mb-4">
                <label for="login-password" class="form-label">Password</label>
                <input type="password" id="login-password" name="password" class="form-control"
                       autocomplete="current-password" required placeholder="Your password">
              </div>
              <button type="submit" class="btn btn-primary w-100" data-submit>Sign in</button>
            </form>

            <p class="text-center text-body-secondary small mt-4 mb-0">
              No account yet? <a href="/register" data-link>Create one</a>
            </p>
          </div>
        </div>
      </div>`;

    const form = outlet.querySelector("form");
    const errorBox = outlet.querySelector("[data-error]");
    const submitButton = outlet.querySelector("[data-submit]");

    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.classList.remove("d-none");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.classList.add("d-none");

      const email = form.email.value.trim();
      const password = form.password.value;

      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }

      UI.setBusy(submitButton, true, "Signing in...");

      try {
        /* Drop any leftover token first: a wrong password on /auth/login must
           not be treated as an expired session. */
        Token.clear();
        await Auth.signIn(email, password);

        /* The role is read from the backend response, never assumed. */
        const next = query.get("next");
        const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

        UI.toast(`Welcome back, ${Auth.user.name}.`, "success");
        Router.replace(target);
      } catch (error) {
        showError(error.message);
        UI.setBusy(submitButton, false);
      }
    });
  },
};
