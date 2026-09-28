/* Ticket details.

   The permissions below only control which controls are shown. The backend
   enforces the real rules:
   - a customer can only open their own ticket and can only reply
   - a support agent can only open and update tickets assigned to them
   - an admin can open, update and assign any ticket, but the backend
     currently rejects admin messages (POST /tickets/{id}/messages) */

const TicketDetailsPage = {
  async render({ outlet, params }) {
    const ticketId = Number(params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      UI.error(outlet, "This is not a valid ticket number.");
      return;
    }

    UI.loading(outlet, "Loading ticket...");

    let ticket;
    try {
      ticket = await Api.tickets.get(ticketId);
    } catch (error) {
      if (error.status === 403) {
        UI.error(
          outlet,
          "You are not allowed to open this ticket. The backend only returns your own tickets, or the ones assigned to you."
        );
      } else if (error.status === 404) {
        UI.error(outlet, `Ticket #${ticketId} does not exist.`);
      } else {
        UI.error(outlet, error.message, "Reload", () =>
          TicketDetailsPage.render({ outlet, params })
        );
      }
      return;
    }

    let messages = [];
    try {
      messages = await Api.tickets.listMessages(ticketId);
    } catch (error) {
      messages = [];
    }

    /* Admin only: needed to show agent names in the assignment dropdown. */
    let agents = [];
    if (Auth.isRole(ROLES.ADMIN)) {
      try {
        agents = await Api.admin.supportAgents();
      } catch (error) {
        agents = [];
      }
    }

    const role = Auth.role();
    const isAdmin = role === ROLES.ADMIN;
    const isOwnerCustomer = role === ROLES.CUSTOMER && ticket.customer_id === Auth.user.id;
    const isAssignedAgent =
      role === ROLES.SUPPORT_AGENT && ticket.assigned_agent_id === Auth.user.id;

    const canReply = isOwnerCustomer || isAssignedAgent;
    const canUpdate = isAssignedAgent || isAdmin;
    const canAssign = isAdmin;
    const canSuggest = isAssignedAgent || isAdmin;

    outlet.innerHTML = `
      <nav aria-label="breadcrumb" class="mb-3">
        <a href="/tickets" data-link class="text-body-secondary text-decoration-none small">
          <i class="bi bi-arrow-left me-1"></i>Back to tickets
        </a>
      </nav>

      ${UI.pageHeader(
        ticket.subject,
        `Ticket #${ticket.id} · Opened by ${
          ticket.customer ? ticket.customer.name : `customer #${ticket.customer_id}`
        } on ${UI.formatDate(ticket.created_at)}`
      )}

      <div class="row g-4">
        <div class="col-12 col-lg-8">
          ${
            ticket.ai_summary
              ? `<div class="card border-0 shadow-sm mb-4">
                   <div class="card-header bg-transparent">
                     <h2 class="h6 mb-0"><i class="bi bi-stars me-1"></i>AI analysis</h2>
                   </div>
                   <div class="card-body pt-0">
                     ${
                       ticket.ai_summary
                         ? `<p class="mb-2"><strong>Summary:</strong> ${UI.esc(ticket.ai_summary)}</p>`
                         : ""
                     }
                     ${
                       ticket.ai_suggested_action
                         ? `<p class="mb-0 text-body-secondary"><strong>Suggested action:</strong> ${UI.esc(ticket.ai_suggested_action)}</p>`
                         : ""
                     }
                   </div>
                 </div>`
              : ""
          }

          <div class="card border-0 shadow-sm">
            <div class="card-header bg-transparent">
              <h2 class="h6 mb-0">Description</h2>
            </div>
            <div class="card-body pt-0">
              <p class="mb-0 text-break" data-description>${UI.esc(ticket.description)}</p>
            </div>
          </div>

          <div class="card border-0 shadow-sm mt-4">
            <div class="card-header bg-transparent">
              <h2 class="h6 mb-0">Conversation <span class="text-body-secondary small">(${messages.length})</span></h2>
            </div>
            <div class="card-body pt-0">
              <div class="message-list" data-messages>
                ${TicketDetailsPage.renderMessages(messages, Auth.user.id)}
              </div>

              ${
                canReply
                  ? `<form class="mt-3" data-reply-form>
                       <label for="reply-content" class="form-label small text-body-secondary">Add a message</label>
                       <textarea id="reply-content" name="content" class="form-control" rows="3"
                                 required placeholder="Write your reply..."></textarea>
                       <div class="d-flex flex-wrap gap-2 mt-2">
                         <button type="submit" class="btn btn-primary btn-sm" data-send>Send message</button>
                       </div>
                     </form>`
                  : isAdmin
                    ? `<div class="alert alert-secondary mb-0">
                         <i class="bi bi-eye me-1"></i>
                         Read only. The backend does not let an admin post messages on a ticket.
                       </div>`
                    : ""
              }

              ${
                canSuggest
                  ? `<div class="mt-3">
                       <button type="button" class="btn btn-outline-secondary btn-sm" data-suggest>
                         <i class="bi bi-stars me-1"></i>Suggest response
                       </button>
                       <div class="form-text">
                         The AI only produces a draft. Nothing is ever sent automatically:
                         you must review it and send it yourself.
                         ${
                           isAdmin
                             ? " As an admin you cannot post on this ticket, so the draft is only copied to your clipboard."
                             : ""
                         }
                       </div>
                     </div>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-transparent"><h2 class="h6 mb-0">Details</h2></div>
            <div class="card-body pt-0">
              <dl class="row mb-0 small">
                <dt class="col-5 text-body-secondary">Status</dt>
                <dd class="col-7" data-detail-status>${UI.statusBadge(ticket.status)}</dd>

                <dt class="col-5 text-body-secondary">Priority</dt>
                <dd class="col-7" data-detail-priority>${UI.priorityBadge(ticket.priority)}</dd>

                <dt class="col-5 text-body-secondary">Category</dt>
                <dd class="col-7">${UI.esc(UI.categoryLabel(ticket.category))}</dd>

                <dt class="col-5 text-body-secondary">Customer</dt>
                <dd class="col-7 mb-0">${UI.esc(
                  ticket.customer ? ticket.customer.name : `#${ticket.customer_id}`
                )}</dd>
                ${
                  ticket.customer
                    ? `<dt class="col-5 text-body-secondary">Email</dt>
                       <dd class="col-7 mb-0 text-break">${UI.esc(ticket.customer.email)}</dd>`
                    : ""
                }

                <dt class="col-5 text-body-secondary">Assigned to</dt>
                <dd class="col-7 mb-0" data-detail-agent>${
                  ticket.assigned_agent_id === null || ticket.assigned_agent_id === undefined
                    ? '<span class="text-body-secondary">Unassigned</span>'
                    : (agents.find((agent) => agent.id === ticket.assigned_agent_id)
                        ? UI.esc(
                            agents.find((agent) => agent.id === ticket.assigned_agent_id).name
                          )
                        : `<span class="text-body-secondary">Agent #${UI.esc(ticket.assigned_agent_id)}</span>`)
                }</dd>

                <dt class="col-5 text-body-secondary">Last update</dt>
                <dd class="col-7 mb-0">${UI.esc(UI.formatDate(ticket.updated_at))}</dd>
              </dl>
            </div>
          </div>

          ${
            canUpdate
              ? `<div class="card border-0 shadow-sm mb-4">
                   <div class="card-header bg-transparent"><h2 class="h6 mb-0">Manage ticket</h2></div>
                   <div class="card-body pt-0">
                     <div class="alert alert-danger d-none" data-manage-error role="alert"></div>
                     <form data-update-form>
                       <div class="mb-3">
                         <label for="update-status" class="form-label small">Status</label>
                         <select id="update-status" name="status" class="form-select">
                           ${Object.entries(STATUS_LABELS)
                             .map(
                               ([value, label]) =>
                                 `<option value="${UI.esc(value)}" ${
                                   value === ticket.status ? "selected" : ""
                                 }>${UI.esc(label)}</option>`
                             )
                             .join("")}
                         </select>
                       </div>
                       <div class="mb-3">
                         <label for="update-priority" class="form-label small">Priority</label>
                         <select id="update-priority" name="priority" class="form-select">
                           ${Object.entries(PRIORITY_LABELS)
                             .map(
                               ([value, label]) =>
                                 `<option value="${UI.esc(value)}" ${
                                   value === ticket.priority ? "selected" : ""
                                 }>${UI.esc(label)}</option>`
                             )
                             .join("")}
                         </select>
                       </div>
                       <button type="submit" class="btn btn-primary btn-sm" data-update-submit>Save changes</button>
                     </form>
                   </div>
                 </div>`
              : ""
          }

          ${
            canAssign
              ? `<div class="card border-0 shadow-sm">
                   <div class="card-header bg-transparent"><h2 class="h6 mb-0">Assignment</h2></div>
                   <div class="card-body pt-0">
                     <div class="alert alert-danger d-none" data-assign-error role="alert"></div>
                     <form data-assign-form>
                       <div class="mb-3">
                         <label for="assign-agent" class="form-label small">Support agent</label>
                         <select id="assign-agent" name="agent_id" class="form-select">
                           <option value="" selected disabled>Choose a support agent...</option>
                           ${agents
                             .filter((agent) => agent.account_status === "active")
                             .map(
                               (agent) =>
                                 `<option value="${UI.esc(agent.id)}" ${
                                   agent.id === ticket.assigned_agent_id ? "selected" : ""
                                 }>${UI.esc(agent.name)}</option>`
                             )
                             .join("")}
                         </select>
                         <div class="form-text">
                           The backend cannot unassign a ticket, only give it to an active agent.
                         </div>
                         ${
                           agents.filter((agent) => agent.account_status === "active").length === 0
                             ? '<div class="form-text">No active support agent is available.</div>'
                             : ""
                         }
                       </div>
                       <button type="submit" class="btn btn-primary btn-sm" data-assign-submit>Assign</button>
                     </form>
                   </div>
                 </div>`
              : ""
          }
        </div>
      </div>`;

    TicketDetailsPage.bindEvents({ outlet, ticket, agents });
  },

  renderMessages(messages, currentUserId) {
    if (!messages.length) {
      return `<p class="text-body-secondary small mb-0">No message yet.</p>`;
    }

    return messages
      .map((message) => {
        const mine = message.sender_id === currentUserId;
        const senderName = message.sender ? message.sender.name : `User #${message.sender_id}`;

        return `
          <div class="message ${mine ? "message-mine" : "message-theirs"}">
            <div class="message-meta">
              <span class="fw-semibold">${UI.esc(senderName)}</span>
              <span class="text-body-secondary small">${UI.esc(UI.formatDate(message.timestamp))}</span>
            </div>
            <div class="message-bubble">${UI.esc(message.content)}</div>
          </div>`;
      })
      .join("");
  },

  bindEvents({ outlet, ticket, agents }) {
    const ticketId = ticket.id;
    const messagesBox = outlet.querySelector("[data-messages]");

    const refreshMessages = async () => {
      try {
        const fresh = await Api.tickets.listMessages(ticketId);
        messagesBox.innerHTML = TicketDetailsPage.renderMessages(fresh, Auth.user.id);
      } catch (error) {
        /* keep the messages already on screen */
      }
    };

    /* ---------- reply ---------- */

    const replyForm = outlet.querySelector("[data-reply-form]");
    const replyInput = outlet.querySelector("#reply-content");

    if (replyForm && replyInput) {
      const sendButton = outlet.querySelector("[data-send]");

      replyForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const content = replyInput.value.trim();
        if (!content) {
          UI.toast("Write a message first.", "warning");
          return;
        }

        UI.setBusy(sendButton, true, "Sending...");

        try {
          await Api.tickets.sendMessage(ticketId, content);
          replyInput.value = "";
          await refreshMessages();
          UI.toast("Message sent.", "success");
        } catch (error) {
          UI.setBusy(sendButton, false);
          UI.toast(error.message, "danger");
        }
      });
    }

    /* ---------- AI suggested response ---------- */

    const suggestButton = outlet.querySelector("[data-suggest]");

    if (suggestButton) {
      suggestButton.addEventListener("click", async () => {
        UI.setBusy(suggestButton, true, "Generating...");

        let suggestion;
        try {
          const result = await Api.ai.suggestResponse(ticketId);
          suggestion = result.suggested_response;
        } catch (error) {
          UI.setBusy(suggestButton, false);
          UI.toast(error.message, "danger");
          return;
        }

        UI.setBusy(suggestButton, false);

        /* An admin can ask for a suggestion but cannot post on the ticket,
           so there is no reply box to load the draft into. */
        const canUseReplyBox = Boolean(replyInput);
        const actionLabel = canUseReplyBox ? "Use as my reply" : "Copy to clipboard";

        const modal = UI.openModal({
          title: "AI suggested response",
          size: "modal-lg",
          bodyHtml: `
            <div class="alert alert-warning small">
              This is an AI draft. Review and edit it before you send it to the customer.
            </div>
            <textarea id="suggestion-editor" class="form-control" rows="10">${UI.esc(suggestion)}</textarea>`,
          footerHtml: `
            <button type="button" class="btn btn-outline-secondary" data-modal-close>Discard</button>
            <button type="button" class="btn btn-primary" data-use-draft>${actionLabel}</button>`,
        });

        modal
          .querySelector("[data-use-draft]")
          .addEventListener("click", async () => {
            const draft = modal.querySelector("#suggestion-editor").value;

            if (canUseReplyBox) {
              replyInput.value = draft;
              UI.closeModal();
              replyInput.focus();
              UI.toast("Draft loaded into the reply box. Edit it, then send.", "info");
              return;
            }

            try {
              await navigator.clipboard.writeText(draft);
              UI.closeModal();
              UI.toast("Draft copied. The backend does not let an admin post on a ticket.", "info");
            } catch (error) {
              UI.toast("Could not copy automatically. Select the text and copy it manually.", "warning");
            }
          });
      });
    }

    /* ---------- status and priority ---------- */

    const updateForm = outlet.querySelector("[data-update-form]");

    if (updateForm) {
      const updateButton = outlet.querySelector("[data-update-submit]");
      const updateError = outlet.querySelector("[data-manage-error]");

      updateForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        updateError.classList.add("d-none");

        const status = updateForm.elements.namedItem("status").value;
        const priority = updateForm.elements.namedItem("priority").value;

        if (status === ticket.status && priority === ticket.priority) {
          UI.toast("Nothing to update.", "info");
          return;
        }

        UI.setBusy(updateButton, true, "Saving...");

        try {
          const updated = await Api.tickets.update(ticketId, status, priority);
          outlet.querySelector("[data-detail-status]").innerHTML = UI.statusBadge(updated.status);
          outlet.querySelector("[data-detail-priority]").innerHTML = UI.priorityBadge(updated.priority);
          ticket.status = updated.status;
          ticket.priority = updated.priority;
          UI.toast("Ticket updated.", "success");
        } catch (error) {
          updateError.textContent = error.message;
          updateError.classList.remove("d-none");
        } finally {
          UI.setBusy(updateButton, false);
        }
      });
    }

    /* ---------- assignment (admin only) ---------- */

    const assignForm = outlet.querySelector("[data-assign-form]");

    if (assignForm) {
      const assignButton = outlet.querySelector("[data-assign-submit]");
      const assignError = outlet.querySelector("[data-assign-error]");
      const agentSelect = outlet.querySelector("#assign-agent");

      assignForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        assignError.classList.add("d-none");

        const agentId = agentSelect.value;

        if (!agentId) {
          assignError.textContent = "Choose a support agent first.";
          assignError.classList.remove("d-none");
          return;
        }

        UI.setBusy(assignButton, true, "Assigning...");

        try {
          const updated = await Api.tickets.assign(ticketId, Number(agentId));

          ticket.assigned_agent_id = updated.assigned_agent_id;
          const detailAgent = outlet.querySelector("[data-detail-agent]");
          const agent = agents.find((item) => item.id === updated.assigned_agent_id);
          detailAgent.innerHTML = agent
            ? UI.esc(agent.name)
            : '<span class="text-body-secondary">Unassigned</span>';

          UI.toast("Ticket assignment updated.", "success");
        } catch (error) {
          assignError.textContent = error.message;
          assignError.classList.remove("d-none");
        } finally {
          UI.setBusy(assignButton, false);
        }
      });
    }
  },
};
