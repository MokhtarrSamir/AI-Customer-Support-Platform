/* Register page. Calls POST /auth/register.

   The backend does not return a token here, it only creates the account, so
   after a successful registration the user is sent to the login page. */

const RegisterPage = {
  async render({ outlet }) {
    outlet.innerHTML = `
      <div class="auth-wrapper">
        <div class="card auth-card border-0 shadow-sm">
          <div class="card-body p-4 p-md-5">
            <div class="text-center mb-4">
              <div class="brand-mark mx-auto mb-3"><i class="bi bi-person-plus"></i></div>
              <h1 class="h4 mb-1">Create your account</h1>
              <p class="text-body-secondary small mb-0">
                New accounts are created with the customer role.
              </p>
            </div>

            <div class="alert alert-danger d-none" data-error role="alert"></div>

            <form novalidate>
              <div class="mb-3">
                <label for="register-name" class="form-label">Full name</label>
                <input type="text" id="register-name" name="name" class="form-control"
                       autocomplete="name" required placeholder="Jane Doe">
              </div>
              <div class="mb-3">
                <label for="register-email" class="form-label">Email</label>
                <input type="email" id="register-email" name="email" class="form-control"
                       autocomplete="email" required placeholder="you@example.com">
              </div>
              <div class="mb-4">
                <label for="register-password" class="form-label">Password</label>
                <input type="password" id="register-password" name="password" class="form-control"
                       autocomplete="new-password" required placeholder="Choose a password">
                <div class="form-text">
                  The backend does not enforce a minimum length. Use a strong password anyway.
                </div>
              </div>
              <button type="submit" class="btn btn-primary w-100" data-submit>Create account</button>
            </form>

            <p class="text-center text-body-secondary small mt-4 mb-0">
              Already registered? <a href="/login" data-link>Sign in</a>
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

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;

      if (!name || !email || !password) {
        showError("Please fill in all fields.");
        return;
      }

      UI.setBusy(submitButton, true, "Creating account...");

      try {
        await Auth.signUp(name, email, password);
        UI.toast("Account created. You can sign in now.", "success");
        Router.navigate("/login");
      } catch (error) {
        showError(error.message);
        UI.setBusy(submitButton, false);
      }
    });
  },
};
