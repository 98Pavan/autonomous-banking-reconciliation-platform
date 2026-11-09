# Autonomous Banking Reconciliation Platform

An AI-assisted banking operations prototype that helps finance teams process invoice and payment records, identify potential matches, flag discrepancies, and route cases for human review.

> **Project status:** Prototype / synthetic-data demonstration. This project is not connected to live banking systems, does not move money, and is not approved for production banking use.

## Overview

Manual reconciliation can require employees to compare invoice and payment records across spreadsheets and documents. This prototype demonstrates how a coordinated AI workflow can assist with extraction, validation, matching, exception identification, and operational review.

The application provides a banking-operations-style interface for analysts, operations managers, and reviewers.

## Key Features

- **Executive Dashboard** — overview of reconciliation metrics, open exceptions, and pending approvals.
- **File Upload** — upload invoice and payment files for demonstration workflows.
- **Invoice Processing** — extract and review invoice fields and validation flags.
- **Reconciliation Centre** — compare invoice and payment records and identify candidate matches.
- **Exception Management** — review missing payments, duplicate references, date variances, and other discrepancies.
- **AI Agent Operations** — inspect the roles of the extraction and orchestration agents.
- **Approval Centre** — demonstrate simulated human review and approval steps.
- **Reports & Analytics** — review operational metrics and trends.
- **Audit History** — inspect recorded workflow activity.
- **Settings** — configure session-level reconciliation policy values.

## Screenshots

Add screenshots of the actual application to `docs/screenshots/` and use the filenames below. Use only synthetic or redacted data—never upload real customer information, account numbers, or confidential banking records.

| Screen | Screenshot file |
|---|---|
| Executive Dashboard | `docs/screenshots/executive-dashboard.png` |
| File Upload | `docs/screenshots/file-upload.png` |
| Reconciliation Centre | `docs/screenshots/reconciliation-centre.png` |
| Invoice Processing | `docs/screenshots/invoice-processing.png` |
| Approval Centre | `docs/screenshots/approval-centre.png` |

When the images are uploaded, display them here with Markdown, for example:

```md
![Executive Dashboard](docs/screenshots/executive-dashboard.png)
```

## AI Workflow

The workflow is coordinated by three hosted agents:

1. **Invoice Extraction Agent** — extracts and normalizes synthetic invoice fields and identifies missing or duplicate invoice data.
2. **Payment Extraction Agent** — extracts and normalizes synthetic payment fields and identifies missing or duplicate payment data.
3. **Reconciliation Orchestrator** — coordinates extraction, applies reconciliation tolerance rules, and returns results with human-review routing.

The configured workflow uses Anthropic Claude Sonnet 4.6 through Lyzr Agent Studio / Architect.

## Technology Stack

- **Frontend and application:** Next.js, React, TypeScript
- **AI orchestration:** Lyzr Architect and Lyzr Agent Studio
- **AI model provider:** Anthropic Claude Sonnet 4.6
- **UI and styling:** Tailwind CSS and Radix UI components
- **Data / ORM libraries present in the project:** Drizzle ORM

## Reconciliation Policy Demonstration

The current sample policy shown in the application includes:

- Amount tolerance: 0.5%
- Amount tolerance cap: 100 currency units
- Date tolerance: 3 calendar days
- Automatic-match confidence threshold: 95%
- Human-review threshold: 70%
- Same-currency matching only
- Duplicate detection using reference, amount, currency, and a nearby date
- Sensitive-value cases routed for simulated human review

These are demonstration settings, not a recommendation for a real bank's production policy.

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

The development server is configured to use port **3333**. Open:

```
http://localhost:3333
```

To create a production build locally:

```bash
npm run build
npm run start
```

Some environment-dependent features may require configuration. Do not commit API keys, passwords, database credentials, or other secrets. If a local environment file is needed, use an untracked `.env.local` file and follow the project's configuration.

## Important Limitations and Safety

This repository describes a prototype demonstration:

- Uses synthetic demonstration data and uploaded files.
- Does not connect to a real bank, core banking platform, payment rail, or live ledger.
- Does not release payments, change balances, or post ledger entries.
- Approval and policy interactions are simulated and may be session-only.
- The prototype has not been represented as production-certified or security-approved.

Before any real financial use, the system would require security and architecture reviews, strong authentication and role-based authorization, durable and tamper-resistant audit storage, encryption, privacy controls, validation and testing, operational monitoring, and approved integrations with the relevant banking systems.

**Never use real customer or confidential financial data in this demonstration.**

## Repository Structure

The repository includes the Next.js application, reusable UI components, supporting libraries, configuration files, and the Lyzr workflow definition.

Key files and folders include:

- `app/` — Next.js application routes and pages
- `components/` — reusable UI components
- `lib/` — supporting application utilities
- `workflow.json` — Lyzr agent workflow configuration
- `package.json` — project scripts and dependencies

## Future Improvements

- Add persistent, secure storage for approved operational records.
- Implement authentication, role-based permissions, and multi-factor authentication.
- Add stronger audit retention and tamper-evident logging.
- Add automated tests and security reviews.
- Integrate with approved enterprise finance and banking data sources in a controlled environment.
- Add real application screenshots and a short demonstration video.

## Author

Built as an AI-assisted banking reconciliation prototype using Next.js, TypeScript, and Lyzr agent workflows.

---

If you find this project useful, feel free to explore the code and workflow configuration.
