# GhassiCloud

A self-hosted cloud services dashboard and mobile-capable frontend that manages and monitors multiple services. Built with a Node.js/Express backend and a Vite + React (Capacitor-ready) frontend.

---

## Table of contents

- [Project](#project)
- [Features](#features)
- [Architecture](#architecture)
- [Getting started (development)](#getting-started-development)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Common tasks](#common-tasks)
- [Docker / Production](#docker--production)
- [Scripts & utilities](#scripts--utilities)
- [Contributing](#contributing)
- [License](#license)

---

## Project

GhassiCloud provides a dashboard to manage self-hosted services, offers SSO integration, and exposes monitoring and administration functionality through a modern SPA and a simple REST API.

Key characteristics:
- Backend: Node.js/Express
- Frontend: Vite + React, prepared for Capacitor mobile builds
- Supports SSO, service management, logging, and health/audit routes
- Docker-first with Compose files for dev and production

---

## Features

- Centralized UI for service status and control
- SSO and session management
- Audit and reporting endpoints
- Multi-language support (locales included)
- Mobile-ready with Capacitor integration

---

## Architecture

- `backend/` – Express API server, middleware for auth, DB helpers, and routes (`auth`, `audit`, `navidrome`, `services`). Includes Dockerfiles and dev helpers.
- `frontend/` – Vite + React application. Uses contexts, hooks, and componentized UI. Has PWA and Capacitor config to generate mobile builds.
- `docker-compose.yml` and `docker-compose.dev.yml` – orchestration for local setups and development.

---

## Getting started (development)

Prerequisites:
- Node.js (LTS recommended)
- npm
- Docker/docker-compose (for containerized setups)

Quick start (run services locally):

1. Install dependencies

   - Backend:
     ```bash
     cd backend
     npm install
     ```

   - Frontend:
     ```bash
     cd frontend
     npm install
     ```

2. Start development servers

   - Backend (from `backend/`):
     ```bash
     npm run dev
     ```

   - Frontend (from `frontend/`):
     ```bash
     npm run dev
     ```

3. Open the frontend in your browser (Vite will show the local URL, e.g. `http://localhost:3000` by default).

Notes:
- The backend includes `middleware/auth.js` and an auth route. Make sure any required environment variables (auth, DB, Keycloak settings) are present. Check `backend/` for references and scripts such as `keycloak-inspect.js` if using Keycloak.
- The project includes localized translations in `frontend/src/locales/`.

---

## Docker / Production

Run with Docker Compose for a production-like environment:

```bash
# From project root
docker-compose up -d --build
```

For development with services defined in the dev Compose file:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Notes:
- The repository contains `Dockerfile` and `Dockerfile.dev` in both service folders to support optimized production builds and developer-friendly images.
- If using Keycloak or external services, configure environment variables or secrets via your orchestration system.

---

## Scripts & utilities

Useful scripts are located at the repository root and in subfolders:

- `scripts/` – various helper scripts (e.g., `bump-version.js`, `check-avatar-url.js`).
- `backend/scripts/` – admin utilities (e.g., `make-admin.js`, `keycloak-inspect.js`).
- `make-admin.ps1` – PowerShell helper for Windows environments.

There are also VS Code tasks defined in the workspace for installing and starting frontend/backend services (see `.vscode/tasks.json` if present).