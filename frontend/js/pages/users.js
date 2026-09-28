/* User management (admin only, enforced by the router and by the backend).

   Endpoints used: GET /users, GET /users/{id}, PATCH /users/{id}/disable,
   PATCH /users/{id}/activate, DELETE /users/{id}. */

const UsersPage = {
  async render({ outlet }) {
    UI.loading(outlet, "Loading users...");

    let users;
    try {
      users = await Api.users.list();
    } catch (error) {
      UI.error(outlet, error.message, "Reload", () => UsersPage.render({ outlet }));
      return;
    }

    outlet.innerHTML = `
      ${UI.pageHeader(
        "Users",
        "Every account registered in the platform. The backend only returns this list to admins."
      )}

      <div class="row g-3 mb-4">
        ${UI.statCard("Total users", users.length, "primary", "bi-people")}
        ${UI.statCard(
          "Customers",
          users.filter((user) => user.role === ROLES.CUSTOMER).length,
          "secondary",
          "bi-person"
        )}
        ${UI.statCard(
          "Support agents",
          users.filter((user) => user.role === ROLES.SUPPORT_AGENT).length,
          "info",
          "bi-headset"
        )}
        ${UI.statCard(
          "Disabled",
          users.filter((user) => user.account_status === "disabled").length,
          "danger",
          "bi-slash-circle"
        )}
      </div>

      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-6">
              <label for="user-search" class="form-label small text-body-secondary">Search</label>
              <input type="search" id="user-search" class="form-control" placeholder="Name or email">
            </div>
            <div class="col-6 col-md-3">
              <label for="user-role" class="form-label small text-body-secondary">Role</label>
              <select id="user-role" class="form-select">
                <option value="">All roles</option>
                <option value="${ROLES.CUSTOMER}">Customer</option>
                <option value="${ROLES.SUPPORT_AGENT}">Support agent</option>
                <option value="${ROLES.ADMIN}">Admin</option>
              </select>
            </div>
            <div class="col-6 col-md-3">
              <label for="user-status" class="form-label small text-body-secondary">Status</label>
              <select id="user-status" class="form-select">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h2 class="h6 mb-0" data-summary>${users.length} user(s)</h2>
        </div>
        <div data-results></div>
      </div>`;

    const results = outlet.querySelector("[data-results]");
    const summary = outlet.querySelector("[data-summary]");
    const searchInput = outlet.querySelector("#user-search");
    const roleSelect = outlet.querySelector("#user-role");
    const statusSelect = outlet.querySelector("#user-status");

    const renderRows = () => {
      const term = searchInput.value.trim().toLowerCase();
      const role = roleSelect.value;
      const status = statusSelect.value;

      const filtered = users.filter((user) => {
        if (role && user.role !== role) return false;
        if (status && user.account_status !== status) return false;
        if (term && !`${user.name} ${user.email}`.toLowerCase().includes(term)) return false;
        return true;
      });

      summary.textContent =
        filtered.length === users.length
          ? `${users.length} user(s)`
          : `${filtered.length} of ${users.length} user(s)`;

      if (!filtered.length) {
        results.innerHTML = `
          <div class="card-body text-center py-5">
            <div class="empty-icon mb-3"><i class="bi bi-search"></i></div>
            <h3 class="h6">No user matches your filters</h3>
          </div>`;
        return;
      }

      results.innerHTML = UsersPage.table(filtered);
    };

    searchInput.addEventListener("input", renderRows);
    roleSelect.addEventListener("change", renderRows);
    statusSelect.addEventListener("change", renderRows);

    renderRows();

    UsersPage.bindActions({ outlet, users, rerenderRows: renderRows });
  },

  table(users) {
    const currentUserId = Auth.user.id;

    return `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Name</th>
              <th scope="col" class="d-none d-md-table-cell">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col" class="d-none d-lg-table-cell">Registered</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map((user) => {
                const isSelf = user.id === currentUserId;
                const isDisabled = user.account_status === "disabled";

                return `
                <tr>
                  <td class="text-body-secondary">${UI.esc(user.id)}</td>
                  <td>
                    ${UI.esc(user.name)}
                    ${isSelf ? '<span class="badge text-bg-light border ms-1">You</span>' : ""}
                  </td>
                  <td class="d-none d-md-table-cell text-break">${UI.esc(user.email)}</td>
                  <td>${UI.esc(UI.roleLabel(user.role))}</td>
                  <td>${UI.accountBadge(user.account_status)}</td>
                  <td class="d-none d-lg-table-cell text-body-secondary small">${UI.esc(
                    UI.formatDateOnly(user.created_at)
                  )}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm" role="group">
                      <button type="button" class="btn btn-outline-secondary" data-view="${UI.esc(user.id)}">
                        View
                      </button>
                      <button type="button" class="btn btn-outline-${isDisabled ? "success" : "warning"}"
                              data-toggle="${UI.esc(user.id)}">
                        ${isDisabled ? "Activate" : "Disable"}
                      </button>
                      <button type="button" class="btn btn-outline-danger" data-delete="${UI.esc(user.id)}"
                              ${isSelf ? "disabled title='An admin cannot delete their own account'" : ""}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
  },

  bindActions({ outlet, users, rerenderRows }) {
    const findUser = (id) => users.find((user) => user.id === id);

    outlet.addEventListener("click", async (event) => {
      const viewButton = event.target.closest("[data-view]");
      const toggleButton = event.target.closest("[data-toggle]");
      const deleteButton = event.target.closest("[data-delete]");

      /* ---------- details ---------- */

      if (viewButton) {
        const id = Number(viewButton.dataset.view);
        const fallback = findUser(id);

        let detail = fallback;
        try {
          detail = await Api.users.get(id);
        } catch (error) {
          UI.toast(error.message, "danger");
          if (!fallback) return;
        }

        UI.openModal({
          title: "User details",
          bodyHtml: `
            <dl class="row mb-0">
              <dt class="col-4 text-body-secondary">ID</dt><dd class="col-8">${UI.esc(detail.id)}</dd>
              <dt class="col-4 text-body-secondary">Name</dt><dd class="col-8">${UI.esc(detail.name)}</dd>
              <dt class="col-4 text-body-secondary">Email</dt><dd class="col-8 text-break">${UI.esc(detail.email)}</dd>
              <dt class="col-4 text-body-secondary">Role</dt><dd class="col-8">${UI.esc(UI.roleLabel(detail.role))}</dd>
              <dt class="col-4 text-body-secondary">Status</dt><dd class="col-8">${UI.accountBadge(detail.account_status)}</dd>
              <dt class="col-4 text-body-secondary">Registered</dt><dd class="col-8">${UI.esc(UI.formatDate(detail.created_at))}</dd>
            </dl>
            <div class="alert alert-secondary small mt-3 mb-0">
              The backend has no endpoint for the tickets of a user, so they cannot be listed here.
            </div>`,
          footerHtml: `<button type="button" class="btn btn-outline-secondary" data-modal-close>Close</button>`,
        });
        return;
      }

      /* ---------- activate / disable ---------- */

      if (toggleButton) {
        const id = Number(toggleButton.dataset.toggle);
        const user = findUser(id);
        if (!user) return;

        const disabling = user.account_status === "active";
        const confirmed = await UI.confirm({
          title: disabling ? "Disable account" : "Activate account",
          message: disabling
            ? `${user.name} will not be able to sign in or use the API until the account is activated again.`
            : `${user.name} will be able to sign in again.`,
          confirmLabel: disabling ? "Disable" : "Activate",
          variant: disabling ? "warning" : "success",
        });

        if (!confirmed) return;

        UI.setBusy(toggleButton, true, "...");

        try {
          const updated = disabling
            ? await Api.users.disable(id)
            : await Api.users.activate(id);

          user.account_status = updated.account_status;
          UI.toast(`${user.name} is now ${updated.account_status}.`, "success");
          rerenderRows();
        } catch (error) {
          UI.setBusy(toggleButton, false);
          UI.toast(error.message, "danger");
        }
      }

      /* ---------- delete ---------- */

      if (deleteButton) {
        const id = Number(deleteButton.dataset.delete);
        const user = findUser(id);
        if (!user) return;

        if (user.id === Auth.user.id) {
          UI.toast("An admin cannot delete their own account.", "warning");
          return;
        }

        const confirmed = await UI.confirm({
          title: "Delete user",
          message: `${user.name} (${user.email}) will be permanently removed. This cannot be undone.`,
          confirmLabel: "Delete permanently",
        });

        if (!confirmed) return;

        UI.setBusy(deleteButton, true, "...");

        try {
          await Api.users.remove(id);
          users.splice(users.indexOf(user), 1);
          UI.toast(`${user.name} was deleted.`, "success");
          rerenderRows();
        } catch (error) {
          UI.setBusy(deleteButton, false);
          UI.toast(error.message, "danger");
        }
      }
    });
  },
};
