# Autonomous Banking Reconciliation Platform

An AI-assisted banking operations prototype that helps finance teams process invoice and payment records, identify potential matches, flag discrepancies, and route cases for human review.

> **Project status:** Prototype using synthetic demonstration data. It is not connected to live banking systems, does not move money, and is not approved for production banking use.

## Overview

Manual reconciliation often requires employees to compare invoice and payment records across spreadsheets and documents. This project demonstrates how coordinated AI agents can assist with extraction, validation, matching, exception identification, and operational review.

## Architecture

![Prototype architecture](docs/architecture.svg)

## Reconciliation workflow

![Reconciliation workflow](docs/reconciliation-workflow.svg)

## Key Features

- **Executive Dashboard** — overview of reconciliation metrics, open exceptions, and pending approvals.
- **File Upload** — upload invoice and payment files for demonstration workflows.
- **Reconciliation Centre** — compare invoice and payment records and identify candidate matches.
- **Invoice Processing** — extract and review invoice fields and validation flags.
- **Exception Management** — review missing payments, duplicate references, date variances, and other discrepancies.
- **AI Agent Operations** — inspect the roles of the extraction and orchestration agents.
- **Approval Centre** — demonstrate simulated human review and approval steps.
- **Reports & Analytics** — review operational metrics and trends.
- **Audit History** — inspect recorded workflow activity.
- **Settings** — configure session-level reconciliation policy values.

## AI Agents

1. **Invoice Extraction Agent** — extracts and normalizes synthetic invoice fields and identifies missing or duplicate invoice data.
2. **Payment Extraction Agent** — extracts and normalizes synthetic payment fields and identifies missing or duplicate payment data.
3. **Reconciliation Orchestrator** — coordinates extraction, applies reconciliation tolerance rules, and returns results with human-review routing.

The configured workflow uses Anthropic Claude Sonnet 4.6 through Lyzr Agent Studio / Architect.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **AI orchestration:** Lyzr Architect and Lyzr Agent Studio
- **AI model provider:** Anthropic Claude Sonnet 4.6
- **UI:** Tailwind CSS and Radix UI components
- **Data libraries present:** Drizzle ORM

## Reconciliation Policy Demonstration

The sample policy shown in the prototype includes:

- Amount tolerance: 0.5%
- Amount tolerance cap: 100 currency units
- Date tolerance: 3 calendar days
- Automatic-match confidence threshold: 95%
- Human-review threshold: 70%
- Same-currency matching only
- Duplicate detection using reference, amount, currency, and a nearby date
- Sensitive-value cases routed for simulated human review

These are demonstration settings, not a recommendation for a real bank's production policy.

## Application Screenshots

The diagrams above explain the concept and workflow; they are **not screenshots of the running application**. Add genuine screenshots of the app here when ready. Use synthetic or fully redacted data only.

Suggested screenshots:
- Executive Dashboard
- File Upload
- Reconciliation Centre
- Invoice Processing
- Approval Centre

To add a screenshot, upload it to `docs/screenshots/` and embed it like this:

```md
![Executive Dashboard](docs/screenshots/executive-dashboard.png)
```

## Run Locally

### Prerequisites

- Node.js (LTS recommended)
- npm
- Git

### Setup

```bash
git clone https://github.com/98Pavan/autonomous-banking-reconciliation-platform.git
cd autonomous-banking-reconciliation-platform
npm install
npm run dev
```

The development server is configured for port **3333**. Open [http://localhost:3333](http://localhost:3333).

To create and run a production build locally:

```bash
npm run build
npm run start
```

Some environment-dependent features may require configuration. Never commit API keys, passwords, database credentials, or other secrets. Use an untracked `.env.local` file for local secrets and follow the project's configuration.

## Safety, Privacy & Limitations

- Uses synthetic demonstration data and uploaded files.
- Does not connect to a real bank, core banking platform, payment rail, or live ledger.
- Does not release payments, change balances, or post ledger entries.
- Approval and policy interactions are simulated and may be session-only.
- The prototype has not been represented as production-certified or security-approved.
- Do not upload real customer data, account numbers, bank statements, or confidential financial information.

Before any real financial use, the system would require security and architecture reviews, strong authentication and role-based authorization, durable and tamper-resistant audit storage, encryption, privacy controls, validation and testing, operational monitoring, and approved integrations with relevant banking systems.

## Repository Structure

- `app/` — Next.js application routes and pages
- `components/` — reusable UI components
- `lib/` — supporting application utilities
- `workflow.json` — Lyzr agent workflow configuration
- `package.json` — scripts and dependencies
- `docs/` — project diagrams and documentation assets

## Future Improvements

- Add persistent, secure storage for operational records.
- Implement authentication, role-based permissions, and multi-factor authentication.
- Add stronger audit retention and tamper-evident logging.
- Add automated tests and security reviews.
- Integrate with approved enterprise finance and banking data sources in a controlled environment.
- Add genuine application screenshots and a short demonstration video.

---

Built as an AI-assisted banking reconciliation prototype using Next.js, TypeScript, and Lyzr agent workflows.
