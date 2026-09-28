/* Ticket list.

   GET /tickets takes no query parameters, so the search box and the filters
   run in the browser on the list the backend already returned. The backend has
   already removed every ticket the current role is not allowed to see, so this
   is a usability feature and not an authorization check. */

const TicketsPage = {
  async render({ outlet }) {
    const role = Auth.role();
    const isCustomer = role === ROLES.CUSTOMER;

    UI.loading(outlet, "Loading tickets...");

    let tickets;
    try {
      tickets = await Api.tickets.list();
    } catch (error) {
      UI.error(outlet, error.message, "Reload", () => TicketsPage.render({ outlet }));
      return;
    }

    /* Only admins may call GET /admin/support-agents, so agent names can only
       be resolved for admins. */
    let agentNames = {};
    if (role === ROLES.ADMIN) {
      try {
        const agents = await Api.admin.supportAgents();
        agentNames = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
      } catch (error) {
        agentNames = {};
      }
    }

    outlet.innerHTML = `
      ${UI.pageHeader(
        isCustomer ? "My tickets" : "Tickets",
        isCustomer
          ? "Only the tickets you created are returned by the backend."
          : role === ROLES.SUPPORT_AGENT
            ? "The backend returns only the tickets assigned to you."
            : "Every ticket in the system.",
        isCustomer
          ? `<a href="/tickets/create" data-link class="btn btn-primary">
               <i class="bi bi-plus-lg me-1"></i>Create ticket
             </a>`
          : ""
      )}

      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-lg-5">
              <label for="filter-search" class="form-label small text-body-secondary">Search</label>
              <input type="search" id="filter-search" class="form-control"
                     placeholder="Subject, description or ticket number">
            </div>
            <div class="col-6 col-lg">
              <label for="filter-status" class="form-label small text-body-secondary">Status</label>
              <select id="filter-status" class="form-select">
                <option value="">All statuses</option>
                ${Object.entries(STATUS_LABELS)
                  .map(([value, label]) => `<option value="${UI.esc(value)}">${UI.esc(label)}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="col-6 col-lg">
              <label for="filter-priority" class="form-label small text-body-secondary">Priority</label>
              <select id="filter-priority" class="form-select">
                <option value="">All priorities</option>
                ${Object.entries(PRIORITY_LABELS)
                  .map(([value, label]) => `<option value="${UI.esc(value)}">${UI.esc(label)}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="col-12 col-lg">
              <label for="filter-category" class="form-label small text-body-secondary">Category</label>
              <select id="filter-category" class="form-select">
                <option value="">All categories</option>
                ${Object.entries(CATEGORY_LABELS)
                  .map(([value, label]) => `<option value="${UI.esc(value)}">${UI.esc(label)}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h2 class="h6 mb-0" data-summary>${tickets.length} ticket(s)</h2>
          <button type="button" class="btn btn-sm btn-link" data-reset hidden>Clear filters</button>
        </div>
        <div data-results>${TicketTable.render(tickets, agentNames)}</div>
      </div>`;

    const results = outlet.querySelector("[data-results]");
    const summary = outlet.querySelector("[data-summary]");
    const resetButton = outlet.querySelector("[data-reset]");

    const searchInput = outlet.querySelector("#filter-search");
    const statusSelect = outlet.querySelector("#filter-status");
    const prioritySelect = outlet.querySelector("#filter-priority");
    const categorySelect = outlet.querySelector("#filter-category");

    const applyFilters = () => {
      const term = searchInput.value.trim().toLowerCase();
      const status = statusSelect.value;
      const priority = prioritySelect.value;
      const category = categorySelect.value;

      const filtered = tickets.filter((ticket) => {
        if (status && ticket.status !== status) return false;
        if (priority && ticket.priority !== priority) return false;
        if (category && ticket.category !== category) return false;

        if (term) {
          const haystack = [
            ticket.id,
            ticket.subject,
            ticket.description,
            ticket.customer ? ticket.customer.name : "",
            ticket.ai_summary || "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        return true;
      });

      const sorting = TicketTable.newest(filtered, filtered.length);

      if (!sorting.length) {
        results.innerHTML = `
          <div class="card-body text-center py-5">
            <div class="empty-icon mb-3"><i class="bi bi-search"></i></div>
            <h3 class="h6">No ticket matches your filters</h3>
            <p class="text-body-secondary small mb-0">Try a different search term or clear the filters.</p>
          </div>`;
      } else {
        results.innerHTML = TicketTable.render(sorting, agentNames);
      }

      summary.textContent =
        filtered.length === tickets.length
          ? `${tickets.length} ticket(s)`
          : `${filtered.length} of ${tickets.length} ticket(s)`;

      resetButton.hidden = !term && !status && !priority && !category;
    };

    searchInput.addEventListener("input", applyFilters);
    [statusSelect, prioritySelect, categorySelect].forEach((element) =>
      element.addEventListener("change", applyFilters)
    );

    resetButton.addEventListener("click", () => {
      searchInput.value = "";
      statusSelect.value = "";
      prioritySelect.value = "";
      categorySelect.value = "";
      applyFilters();
    });

    if (!tickets.length) {
      results.innerHTML = `
        <div class="card-body text-center py-5">
          <div class="empty-icon mb-3"><i class="bi bi-inbox"></i></div>
          <h3 class="h6">No tickets to show</h3>
          <p class="text-body-secondary small mb-0">${
            isCustomer
              ? "You have not created any ticket yet."
              : role === ROLES.SUPPORT_AGENT
                ? "No ticket is assigned to your account right now."
                : "No ticket exists in the system yet."
          }</p>
        </div>`;
    }
  },
};
