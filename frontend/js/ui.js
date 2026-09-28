/* Small UI helpers shared by every page.

   Only Bootstrap CSS is used, no Bootstrap JavaScript, so the toasts, modals
   and the mobile sidebar are plain vanilla JavaScript. */

const UI = {
  /* Always escape text coming from the API before putting it in innerHTML. */
  esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /* ---------- toasts ---------- */

  toast(message, type = "info") {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "toast-host";
      document.body.appendChild(host);
    }

    const element = document.createElement("div");
    element.className = `alert alert-${type} shadow-sm d-flex align-items-start gap-2 mb-2`;
    element.setAttribute("role", "status");
    element.innerHTML = `
      <div class="flex-grow-1">${this.esc(message)}</div>
      <button type="button" class="btn-close" aria-label="Close"></button>`;

    const remove = () => {
      if (element.parentNode) element.parentNode.removeChild(element);
    };

    element.querySelector(".btn-close").addEventListener("click", remove);
    host.appendChild(element);
    setTimeout(remove, type === "danger" ? 8000 : 4500);
  },

  /* ---------- page states ---------- */

  pageHeader(title, subtitle, actionsHtml = "") {
    return `
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 class="h3 mb-1">${this.esc(title)}</h1>
          ${subtitle ? `<p class="text-body-secondary mb-0">${this.esc(subtitle)}</p>` : ""}
        </div>
        ${actionsHtml ? `<div class="d-flex flex-wrap gap-2">${actionsHtml}</div>` : ""}
      </div>`;
  },

  loading(outlet, message = "Loading...") {
    outlet.innerHTML = `
      <div class="text-center py-5" role="status" aria-live="polite">
        <div class="spinner-border text-primary" aria-hidden="true"></div>
        <p class="text-body-secondary mt-3 mb-0">${this.esc(message)}</p>
      </div>`;
  },

  empty(outlet, title, message = "", actionHtml = "") {
    outlet.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5">
          <div class="empty-icon mb-3" aria-hidden="true">
            <i class="bi bi-inbox"></i>
          </div>
          <h2 class="h5">${this.esc(title)}</h2>
          ${message ? `<p class="text-body-secondary mb-0">${this.esc(message)}</p>` : ""}
          ${actionHtml ? `<div class="mt-3">${actionHtml}</div>` : ""}
        </div>
      </div>`;
  },

  error(outlet, message, retryLabel = "Try again", retryCallback = null) {
    outlet.innerHTML = `
      <div class="alert alert-danger d-flex flex-column gap-2" role="alert">
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <div>
            <h5 class="alert-heading mb-1">Could not load this page</h5>
            <p class="mb-0">${this.esc(message)}</p>
          </div>
        </div>
        ${
          retryCallback
            ? `<div><button type="button" class="btn btn-outline-danger btn-sm align-self-start" data-retry>${this.esc(retryLabel)}</button></div>`
            : ""
        }
      </div>`;

    if (retryCallback) {
      outlet
        .querySelector("[data-retry]")
        .addEventListener("click", () => retryCallback());
    }
  },

  /* Replaces a card body with an inline error, used for partial failures. */
  inlineError(container, message) {
    container.innerHTML = `
      <div class="alert alert-danger mb-0" role="alert">${this.esc(message)}</div>`;
  },

  statCard(label, value, variant = "primary", icon = "bi-ticket") {
    return `
      <div class="col-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon text-${variant}"><i class="bi ${icon}"></i></div>
            <div>
              <div class="fs-4 fw-semibold lh-1">${this.esc(value)}</div>
              <div class="text-body-secondary small">${this.esc(label)}</div>
            </div>
          </div>
        </div>
      </div>`;
  },

  /* Disables a button while a request is running, to prevent duplicates. */
  setBusy(button, busy, busyText = "Working...") {
    if (!button) return;

    if (busy) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        ${this.esc(busyText)}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalText !== undefined) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  },

  /* ---------- labels and badges ---------- */

  statusBadge(status) {
    const variants = {
      [STATUS.OPEN]: "primary",
      [STATUS.IN_PROGRESS]: "info",
      [STATUS.WAITING_FOR_CUSTOMER]: "warning",
      [STATUS.RESOLVED]: "success",
      [STATUS.CLOSED]: "secondary",
    };
    const label = STATUS_LABELS[status] || status;
    return `<span class="badge text-bg-${variants[status] || "secondary"}">${this.esc(label)}</span>`;
  },

  priorityBadge(priority) {
    const variants = {
      low: "secondary",
      medium: "info",
      high: "warning",
      critical: "danger",
    };
    const label = PRIORITY_LABELS[priority] || priority;
    return `<span class="badge text-bg-${variants[priority] || "secondary"}">${this.esc(label)}</span>`;
  },

  categoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
  },

  roleLabel(role) {
    return ROLE_LABELS[role] || role;
  },

  accountBadge(accountStatus) {
    const variant = accountStatus === "active" ? "success" : "danger";
    const label = accountStatus === "active" ? "Active" : "Disabled";
    return `<span class="badge text-bg-${variant}">${this.esc(label)}</span>`;
  },

  formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  formatDateOnly(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  },

  /* ---------- modal ---------- */

  openModal({ title, bodyHtml, footerHtml = "", size = "" }) {
    this.closeModal();

    const host = document.getElementById("modal-host");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show";

    const modal = document.createElement("div");
    modal.className = "modal fade show d-block";
    modal.tabIndex = -1;
    modal.setAttribute("role", "dialog");
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${this.esc(title)}</h5>
            <button type="button" class="btn-close" data-modal-close aria-label="Close"></button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
        </div>
      </div>`;

    host.appendChild(backdrop);
    host.appendChild(modal);
    document.body.classList.add("modal-open");
    modal.focus();

    modal.querySelectorAll("[data-modal-close]").forEach((button) => {
      button.addEventListener("click", () => this.closeModal());
    });

    backdrop.addEventListener("click", () => this.closeModal());

    this.activeModal = modal;
    return modal;
  },

  closeModal() {
    const host = document.getElementById("modal-host");
    if (host) host.replaceChildren();
    document.body.classList.remove("modal-open");
    this.activeModal = null;
  },

  /* Promise based confirmation, used before every destructive action. */
  confirm({ title, message, confirmLabel = "Confirm", variant = "danger" }) {
    return new Promise((resolve) => {
      const modal = this.openModal({
        title,
        bodyHtml: `<p class="mb-0">${this.esc(message)}</p>`,
        footerHtml: `
          <button type="button" class="btn btn-outline-secondary" data-modal-close>Cancel</button>
          <button type="button" class="btn btn-${variant}" data-confirm>${this.esc(confirmLabel)}</button>`,
      });

      modal
        .querySelector("[data-confirm]")
        .addEventListener("click", () => {
          this.closeModal();
          resolve(true);
        });

      modal.querySelectorAll("[data-modal-close]").forEach((button) => {
        button.addEventListener("click", () => resolve(false));
      });
    });
  },
};
