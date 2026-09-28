/* Every configuration value used by the frontend lives in this file.
   Change the API URL here only, never inside a page. */

const CONFIG = {
  // Base URL of the FastAPI backend (no trailing slash).
  API_BASE_URL: "http://localhost:8000",

  // Key used to store the JWT access token.
  TOKEN_STORAGE_KEY: "acsp_access_token",
};

/* The three roles the backend can return from /auth/me.
   These are the exact values the FastAPI backend sends. */
const ROLES = {
  CUSTOMER: "customer",
  SUPPORT_AGENT: "support_agent",
  ADMIN: "admin",
};

const ROLE_LABELS = {
  [ROLES.CUSTOMER]: "Customer",
  [ROLES.SUPPORT_AGENT]: "Support agent",
  [ROLES.ADMIN]: "Admin",
};

/* Ticket statuses the backend can return. */
const STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_FOR_CUSTOMER: "waiting_for_customer",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

const STATUS_LABELS = {
  [STATUS.OPEN]: "Open",
  [STATUS.IN_PROGRESS]: "In progress",
  [STATUS.WAITING_FOR_CUSTOMER]: "Waiting for customer",
  [STATUS.RESOLVED]: "Resolved",
  [STATUS.CLOSED]: "Closed",
};

/* Statuses the dashboards count as "not finished yet". */
const ACTIVE_STATUSES = [
  STATUS.OPEN,
  STATUS.IN_PROGRESS,
  STATUS.WAITING_FOR_CUSTOMER,
];

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const CRITICAL_PRIORITY = "critical";

const CATEGORY_LABELS = {
  technical_issue: "Technical issue",
  account_issue: "Account issue",
  billing: "Billing",
  product_issue: "Product issue",
  general_inquiry: "General inquiry",
};
