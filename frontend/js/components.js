/* Shared ticket rendering used by the dashboard and the tickets list.

   The backend already filters GET /tickets by role, so this file only formats
   what the backend returned. It never filters by authorization. */

const TicketCounts = {
  of(tickets) {
    const counts = {
      total: tickets.length,
      open: 0,
      inProgress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
    };

    for (const ticket of tickets) {
      if (ticket.status === STATUS.OPEN) counts.open += 1;
      else if (ticket.status === STATUS.IN_PROGRESS) counts.inProgress += 1;
      else if (ticket.status === STATUS.WAITING_FOR_CUSTOMER) counts.waiting += 1;
      else if (ticket.status === STATUS.RESOLVED) counts.resolved += 1;
      else if (ticket.status === STATUS.CLOSED) counts.closed += 1;

      if (ticket.priority === CRITICAL_PRIORITY) counts.critical += 1;
    }

    counts.active = counts.open + counts.inProgress + counts.waiting;
    return counts;
  },
};

const TicketTable = {
  /* agentNames maps an agent id to a name. It is only available to admins,
     because GET /admin/support-agents is admin only. */
  render(tickets, agentNames) {
    const role = Auth.role();
    const showCustomer = role !== ROLES.CUSTOMER;
    const names = agentNames || {};

    const agentCell = (ticket) => {
      if (ticket.assigned_agent_id === null || ticket.assigned_agent_id === undefined) {
        return '<span class="text-body-secondary">Unassigned</span>';
      }
      const name = names[ticket.assigned_agent_id];
      return name
        ? UI.esc(name)
        : `<span class="text-body-secondary">Agent #${UI.esc(ticket.assigned_agent_id)}</span>`;
    };

    return `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" class="text-nowrap">#</th>
              <th scope="col">Subject</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col" class="d-none d-lg-table-cell">Category</th>
              ${showCustomer ? '<th scope="col" class="d-none d-md-table-cell">Customer</th>' : ""}
              <th scope="col" class="d-none d-lg-table-cell">Assigned to</th>
              <th scope="col" class="d-none d-xl-table-cell">Updated</th>
              <th scope="col" class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            ${tickets
              .map(
                (ticket) => `
              <tr>
                <td class="text-body-secondary">${UI.esc(ticket.id)}</td>
                <td>
                  <a href="/tickets/${UI.esc(ticket.id)}" data-link class="fw-semibold text-decoration-none">
                    ${UI.esc(ticket.subject)}
                  </a>
                </td>
                <td>${UI.statusBadge(ticket.status)}</td>
                <td>${UI.priorityBadge(ticket.priority)}</td>
                <td class="d-none d-lg-table-cell">${UI.esc(UI.categoryLabel(ticket.category))}</td>
                ${
                  showCustomer
                    ? `<td class="d-none d-md-table-cell">${UI.esc(
                        ticket.customer ? ticket.customer.name : `Customer #${ticket.customer_id}`
                      )}</td>`
                    : ""
                }
                <td class="d-none d-lg-table-cell">${agentCell(ticket)}</td>
                <td class="d-none d-xl-table-cell text-body-secondary small">${UI.esc(
                  UI.formatDate(ticket.updated_at)
                )}</td>
                <td class="text-end">
                  <a href="/tickets/${UI.esc(ticket.id)}" data-link class="btn btn-sm btn-outline-primary">
                    Open
                  </a>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  },

  /* Sorts newest first and returns the first n tickets. */
  newest(tickets, limit) {
    return [...tickets]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, limit);
  },
};
