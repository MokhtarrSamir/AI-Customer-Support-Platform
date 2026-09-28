/* Role aware dashboard.

   All numbers come from GET /tickets, which the backend already filters by
   role: a customer sees their own tickets, a support agent only sees the
   tickets assigned to them, an admin sees all of them. */

const DashboardPage = {
  async render({ outlet }) {
    UI.loading(outlet, "Loading your dashboard...");

    let tickets;
    try {
      tickets = await Api.tickets.list();
    } catch (error) {
      UI.error(outlet, error.message, "Reload", () => DashboardPage.render({ outlet }));
      return;
    }

    const role = Auth.role();
    const user = Auth.user;
    const counts = TicketCounts.of(tickets);
    const recent = TicketTable.newest(tickets, 5);

    const isCustomer = role === ROLES.CUSTOMER;
    const isAgent = role === ROLES.SUPPORT_AGENT;
    const isAdmin = role === ROLES.ADMIN;

    const welcomeTitle = isCustomer
      ? `Welcome back, ${user.name}`
      : isAgent
        ? `Your support queue, ${user.name}`
        : `Platform overview, ${user.name}`;

    const welcomeText = isCustomer
      ? "Track your support requests, add messages, and ask the AI assistant for help."
      : isAgent
        ? "These are the tickets currently assigned to you. The backend filters this list for you."
        : "You have full visibility over every ticket, user and AI operation.";

    const quickActions = [
      isCustomer
        ? `<a href="/tickets/create" data-link class="btn btn-primary">
             <i class="bi bi-plus-lg me-1"></i>Create ticket
           </a>`
        : "",
      `<a href="/tickets" data-link class="btn btn-outline-primary">
         <i class="bi bi-ticket-detailed me-1"></i>${isCustomer ? "My tickets" : "Tickets"}
       </a>`,
      `<a href="/ai" data-link class="btn btn-outline-secondary">
         <i class="bi bi-stars me-1"></i>AI assistant
       </a>`,
      isAdmin
        ? `<a href="/statistics" data-link class="btn btn-outline-secondary">
             <i class="bi bi-graph-up me-1"></i>Statistics
           </a>
           <a href="/users" data-link class="btn btn-outline-secondary">
             <i class="bi bi-people me-1"></i>Users
           </a>`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    outlet.innerHTML = `
      ${UI.pageHeader(welcomeTitle, welcomeText, quickActions)}

      <div class="row g-3 mb-4">
        ${
          isCustomer
            ? UI.statCard("My tickets", counts.total, "primary", "bi-ticket") +
              UI.statCard("Open", counts.open, "primary", "bi-folder2-open") +
              UI.statCard("In progress", counts.inProgress, "info", "bi-hourglass-split") +
              UI.statCard("Resolved", counts.resolved, "success", "bi-check-circle")
            : isAgent
              ? UI.statCard("Assigned to me", counts.total, "primary", "bi-person-check") +
                UI.statCard("Open", counts.open, "primary", "bi-folder2-open") +
                UI.statCard("In progress", counts.inProgress, "info", "bi-hourglass-split") +
                UI.statCard("Critical", counts.critical, "danger", "bi-exclamation-triangle")
              : UI.statCard("All tickets", counts.total, "primary", "bi-ticket") +
                UI.statCard("Open", counts.open, "primary", "bi-folder2-open") +
                UI.statCard("In progress", counts.inProgress, "info", "bi-hourglass-split") +
                UI.statCard("Critical", counts.critical, "danger", "bi-exclamation-triangle")
        }
      </div>

      ${
        isAgent
          ? `<div class="card border-0 shadow-sm mb-4">
               <div class="card-body d-flex flex-wrap align-items-center gap-3">
                 <div class="stat-icon text-info"><i class="bi bi-stars"></i></div>
                 <div class="flex-grow-1">
                   <h2 class="h6 mb-1">AI response suggestions</h2>
                   <p class="text-body-secondary small mb-0">
                     Open one of your assigned tickets and use "Suggest response" to get a
                     draft from the AI. You always review and edit it before sending.
                   </p>
                 </div>
                 <a href="/tickets" data-link class="btn btn-sm btn-outline-primary">Open my tickets</a>
               </div>
             </div>`
          : ""
      }

      <div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h2 class="h6 mb-0">${isCustomer ? "My recent tickets" : "Recent tickets"}</h2>
          <a href="/tickets" data-link class="btn btn-sm btn-link">View all</a>
        </div>
        ${
          recent.length
            ? TicketTable.render(recent)
            : `<div class="card-body text-center py-5">
                 <div class="empty-icon mb-3"><i class="bi bi-inbox"></i></div>
                 <h3 class="h6">No tickets yet</h3>
                 <p class="text-body-secondary small mb-3">${
                   isCustomer
                     ? "Create your first ticket and the AI assistant will classify it for you."
                     : isAgent
                       ? "The backend only shows tickets assigned to you. Ask an admin to assign work."
                       : "No tickets have been created yet."
                 }</p>
                 ${
                   isCustomer
                     ? '<a href="/tickets/create" data-link class="btn btn-sm btn-primary">Create ticket</a>'
                     : ""
                 }
               </div>`
        }
      </div>`;
  },
};
