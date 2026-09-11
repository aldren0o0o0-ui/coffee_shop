# Coffee Shop SME Platform — Implementation Plan

## Purpose

Evolve the current single-store coffee-shop system into a mobile-friendly, modular, and scalable operations platform. This plan deliberately excludes supplier management until the business has suppliers to model.

## Current Foundation

The application has a React/Vite frontend and FastAPI/SQLAlchemy backend with modules for authentication, users, menu, inventory, orders, payments, customers, procurement, and analytics. Preserve this modular structure; do not introduce a generic "features" module or mix unrelated business logic into routes.

## Product Scope

Implement, in order:

1. Recipe costing and profitability.
2. Inventory forecasting, waste, and purchase suggestions.
3. Shift management and cash reconciliation.
4. Customer CRM and loyalty automation.
5. Barista production display, customer tracking, and reorder experience.
6. Multi-branch readiness.
7. Owner mobile dashboard and operational alerts.

Not in scope: supplier records, supplier quotations, supplier invoices, or supplier performance scoring.

## Non-Negotiable Engineering Rules

- Each capability belongs in a dedicated backend module: `models.py`, `schemas.py`, `service.py`, `routes.py`, and tests.
- Routes validate/authenticate and call services; services contain business rules; models contain persistence only.
- All monetary and inventory quantities use `Decimal`, never floating point.
- All timestamps are timezone-aware UTC. Convert to Asia/Manila only at presentation boundaries.
- Every mutating endpoint must enforce RBAC, validation, auditability, and idempotency where retries are possible.
- Never expose customer data, receipts, or internal reports through predictable public paths.
- Add Alembic migrations for every schema change; do not rely on `create_all` outside tests.
- Add tests alongside every phase and keep the isolated test database setup intact.

## Cross-Cutting Scale and Reliability Design

### Backend request handling

- Keep FastAPI endpoints stateless so multiple API processes can run behind a load balancer.
- Use PostgreSQL in production. SQLite remains test-only.
- Configure SQLAlchemy pool size, overflow, timeout, and pre-ping through environment settings.
- Add database indexes for all foreign keys, status/date query paths, branch IDs, order reference codes, and customer lookup fields.
- Use pagination and bounded date filters for all lists and reports; never return unbounded order histories.
- Move email, PDF generation, forecasting refresh, cleanup, and notification delivery into durable background jobs. Do not execute long work inside request handlers.
- Add request IDs, structured logs, latency/error metrics, and health/readiness endpoints.
- Apply per-route rate limits: stricter for login, tracking, payment, and public ordering; role-aware limits for staff screens.

### High-order-volume order flow

- Maintain the existing payment idempotency key contract and enforce it with a database unique constraint.
- Use database transactions and row-level locks/conditional updates for inventory settlement.
- Keep order creation, payment confirmation, and inventory deduction short and atomic.
- Use an outbox/event table for post-payment side effects: receipt generation, email, notifications, loyalty credits, and analytics refresh.
- Store status transitions in an append-only order-event/audit table. This supports retries, troubleshooting, and live displays.
- Create indexes equivalent to `(branch_id, order_status, order_date)`, `(branch_id, reference_code)`, and `(customer_id, order_date)` once branches exist.
- Load test before release: start at 50 concurrent customers and increase to the agreed production target; verify no duplicate payments, negative stock, or lost orders.

### Mobile-first frontend

- Support 320px-wide screens first, then tablet and desktop enhancement.
- Use touch targets of at least 44x44px, bottom actions for checkout/submit actions, and no hover-only controls.
- Use responsive table alternatives: cards, accordions, or horizontal scroll with sticky key columns.
- Add loading skeletons, retry states, offline/network error messages, and optimistic UI only where the backend idempotency contract supports it.
- Keep POS desktop-efficient while providing a dedicated compact cashier layout for tablets.
- Test key journeys on phone, tablet, and desktop viewport sizes.

## Phase 0 — Platform Hardening

### Goals

Make deployment and ongoing delivery safe before expanding features.

### Work

- Resolve remaining lint warnings/errors and repair all maintenance scripts.
- Remove generated receipts/uploads from Git tracking while retaining local runtime storage.
- Add CI checks: backend tests, Ruff, frontend lint, frontend build, migration validation.
- Add environment-specific configuration for database pool settings, secure cookies, CORS, logging, and job worker settings.
- Add an audit-log foundation: actor, branch, entity type/id, action, old/new values, request ID, timestamp.
- Add branch-aware base fields only after the branch model is introduced in Phase 6; do not prematurely add nullable branch columns everywhere.

### Exit criteria

- CI is green on a clean clone.
- No generated customer documents are tracked.
- Production health/readiness endpoints and structured logs work.

## Phase 1 — Recipe Costing and Profitability

### New backend module

Create `app/modules/costing/`.

### Data model

- Ingredient cost history: inventory item, unit cost, effective timestamp, source (`manual`, `purchase_receipt`, `adjustment`), actor.
- Menu cost snapshot: menu item/size, calculated ingredient cost, selling price, gross profit, margin percent, calculated timestamp.
- Optional menu price history for later analysis.

### Services and APIs

- Calculate recipe cost from active menu-item ingredients and latest inventory cost.
- Calculate item/category/channel profitability for a selected date range.
- Recalculate affected menu items whenever inventory unit cost or recipe changes.
- Owner/manager endpoints for margin dashboard, low-margin items, and price-impact previews.

### UI

- Add a `CostingPage` with phone-friendly cards and desktop tables.
- Show cost, sale price, gross profit, margin, and warning state.
- Add a menu-editor cost preview before publishing a price or recipe change.

### Tests

- Decimal accuracy, missing-cost behavior, recipe changes, price changes, permissions, and date-range aggregation.

## Phase 2 — Forecasting, Waste, and Purchase Suggestions

### Extend modules

- Extend `inventory`; do not create a separate forecasting module until forecasting logic becomes independently complex.

### Data model

- Inventory waste events: item, quantity, reason, notes, actor, timestamp.
- Demand forecast snapshots: inventory item, branch-ready design, target date, predicted quantity, confidence, method/version.
- Suggested purchase batches: generated date, items, suggested quantity, reason, status (`draft`, `reviewed`, `dismissed`).

### Services and APIs

- Start with transparent moving-average forecasts by weekday and recent sales; no opaque AI model in the first release.
- Combine forecast, on-hand stock, reorder level, reserved order demand, and safety stock to produce suggestions.
- Record waste as an inventory transaction and audit event.
- Add owner/manager review actions for accepting/dismissing suggestions; accepted suggestions create current procurement requests without supplier fields.

### UI

- Low-stock/forecast cards on inventory and owner dashboard.
- Fast waste-entry flow optimized for a phone or tablet.
- Suggested-purchase review screen with reason breakdown.

### Tests

- Forecast determinism, zero-history fallback, no negative suggestion, waste ledger correctness, and authorization.

## Phase 3 — Shifts and Cash Reconciliation

### New backend module

Create `app/modules/shifts/`.

### Data model

- Shift: branch-ready location reference, opened/closed by, opening cash, expected cash, counted cash, variance, status, notes.
- Staff shift attendance: staff, clock-in/out, break durations, manager adjustments.
- Cash movement: paid-in, paid-out, refund, drawer adjustment, reason, actor, approval status.

### Rules

- Only one active register shift per branch/register.
- Cashier may record count; manager/owner approves unexplained variance above a configurable threshold.
- Link cash payments/refunds to the active shift.
- Never permit deletion of closed shifts; use reversal/audit actions.

### UI

- Cashier opening/closing checklist with large numeric keypad controls.
- Owner variance dashboard and approval queue.

### Tests

- Concurrent shift-open protection, expected cash calculation, approval boundaries, refunds, permissions, and immutable audit events.

## Phase 4 — CRM and Loyalty Automation

### Extend modules

- Extend `customers` and `payments`; keep campaign/notification orchestration in a new `engagement` module.

### Data model

- Customer preferences: favourite products, dietary/allergy notes, marketing consent, preferred channel.
- Customer metrics snapshot: visit count, lifetime spend, last order, average order value, loyalty balance.
- Campaign: audience rules, offer, schedule, channel, status.
- Campaign delivery log: customer, campaign, delivery state, provider reference, error.

### Rules

- Explicit marketing consent and unsubscribe support are required before campaign delivery.
- Loyalty earning/redemption remains transaction-ledger based and idempotent.
- Customer data exports/deletion requests must be owner-only and auditable.

### UI

- Customer profile with order history, preferences, loyalty, and notes.
- Owner campaign builder with preview audience count; mobile staff view is read-only except consent updates.

### Tests

- Consent enforcement, audience filters, duplicate-delivery protection, loyalty atomicity, and access controls.

## Phase 5 — Fulfilment, Customer Tracking, and Reordering

### Extend modules

- Extend `orders`; add `app/modules/fulfilment/` only for display/queue-specific service logic.

### Data model

- Order events: event type, actor/system, timestamp, metadata.
- Saved/reorder templates tied to customer consent and active menu availability.

### Features

- Barista display with live queue, elapsed time, priority, item grouping, and accessible sound/visual alerts.
- Customer-facing pickup display exposing only pickup code and safe status.
- Customer tracking uses order ID plus verified email or an opaque tracking token; retain rate limiting.
- One-tap reorder validates current menu, availability, pricing, and stock before cart creation.
- Estimate preparation time from queue state; begin with configurable heuristics.

### Performance

- Push updates with WebSockets or Server-Sent Events; use polling fallback.
- Broadcast lightweight order events, not full report payloads.
- Reconnect safely and re-fetch state after reconnect.

### Tests

- Status ordering, event delivery, no cross-customer data leakage, order retry/idempotency, and queue load tests.

## Phase 6 — Multi-Branch Readiness

### New backend module

Create `app/modules/branches/`.

### Data model and migration strategy

- Branch: name, code, address, timezone, active flag, operational settings.
- Add `branch_id` to operational entities in staged migrations: users/roles assignments, inventory, menu availability/pricing overrides, orders, shifts, procurement requests, analytics snapshots.
- Start with one seeded default branch and backfill all current records to it.
- Use composite uniqueness/indexes where branch scope changes meaning (for example inventory names and order reference lookup).

### Rules

- Users can have one or more branch assignments.
- Owner can access all branches; manager/staff access only assigned branches.
- Inventory transfers are explicit transactions, never direct quantity edits.
- Reports support branch filter and consolidated owner view.

### Tests

- Data isolation, role/branch authorization, default-branch migration, inventory transfers, and consolidated reports.

## Phase 7 — Owner Dashboard and Alerting

### New backend module

Create `app/modules/notifications/` for rule evaluation and delivery state; keep dashboard aggregation in `analytics`.

### Alerts

- Low/critical stock and forecasted stock-out.
- Unusual refunds, cash variance, void rate, failed payments, and order queue delays.
- Low-margin menu items and abrupt ingredient cost changes.
- Pending procurement approvals and expired draft requests.

### UI

- Mobile-first owner dashboard: today’s revenue, orders, cash variance, stock alerts, queue health, and actionable approvals.
- Alert preferences by user, branch, severity, and channel.

### Tests

- Threshold behavior, de-duplication/cooldown, permissions, delivery retries, and dashboard query pagination/caching.

## Delivery Process for Every Phase

1. Create/update architecture decision record if the phase changes data ownership, events, or scaling behavior.
2. Define schema and API contracts before implementation.
3. Add Alembic migration and rollback strategy.
4. Implement service-layer rules and authorization.
5. Implement responsive UI states: loading, empty, error, permission-denied, success.
6. Add unit, API integration, permission, concurrency, and mobile viewport tests.
7. Add observability: structured logs, metrics, alerts, and audit events.
8. Update user/admin documentation and seed/demo data.
9. Run full regression suite, lint, build, migration test, and load test relevant to the phase.

## Definition of Done

A feature is complete only when:

- Database migration is reversible and tested.
- API contract, validation, RBAC, audit record, and idempotency are implemented.
- Mobile and desktop UI behavior is verified.
- Tests are isolated and passing.
- No sensitive data is publicly accessible.
- Dashboards/lists are paginated and indexed.
- Expected request latency and concurrent-order behavior are measured.
- Documentation is updated so another engineer or AI agent can continue without rediscovery.

## Suggested Milestones

| Milestone | Scope | Outcome |
| --- | --- | --- |
| M1 | Phase 0 + Phase 1 | Safe delivery pipeline and margin visibility |
| M2 | Phase 2 + Phase 3 | Lower waste and accountable cash operations |
| M3 | Phase 4 + Phase 5 | Better retention and faster fulfilment |
| M4 | Phase 6 + Phase 7 | Multi-branch operating model and owner controls |

