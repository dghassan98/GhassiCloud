# GhassiCloud

A beautiful PWA dashboard for your self-hosted cloud services. One entry point to access all your services with authentication and a modern UI.

![GhassiCloud Dashboard](https://via.placeholder.com/800x400?text=GhassiCloud+Dashboard)

## Features

- 🎨 **Modern UI** - Beautiful, responsive design with dark/light themes
- 🔐 **Authentication** - JWT-based auth with support for future SSO integration
- 📱 **PWA** - Install on any device, works offline
- ⚡ **Fast** - Built with Vite and React for blazing fast performance
- 🎯 **Service Cards** - Easy access to all your self-hosted services
- 📊 **Stats Dashboard** - Overview of your infrastructure (placeholder for future metrics)
- ⚙️ **Settings** - Customize your experience

## Tech Stack

**Frontend:**
- React 18
- Vite (with PWA plugin)
- React Router
- Framer Motion (animations)
- Lucide React (icons)

**Backend:**
- Node.js / Express
- SQLite (better-sqlite3)
- JWT Authentication
- bcrypt for password hashing

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone and install dependencies:**

```bash
cd GhassiCloud
npm install
```

2. **Configure environment (optional):**

Copy `.env.example` to `.env` and edit the values (do NOT commit `.env`):

```bash
cp .env.example .env
# then edit .env and fill secrets
```

Example values in `.env` include:
```env
PORT=3001
JWT_SECRET=your-super-secret-key
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASS=admin

# Keycloak admin service account (recommended)
KEYCLOAK_URL=https://auth.example.com
KEYCLOAK_REALM=master
KEYCLOAK_ADMIN_CLIENT_ID=ghassicloud-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=your-client-secret

# Or, for quick testing only, you can paste a short-lived admin token (not recommended for production)
# KEYCLOAK_ADMIN_TOKEN=<access_token>
```

Note: `.env` is already included in `.gitignore` to prevent accidentally committing secrets.
3. **Start development servers:**

```bash
npm run dev
```

This starts both frontend (http://localhost:3000) and backend (http://localhost:3001)

4. **Login:**

Default credentials:
- Username: `admin`
- Password: `admin`

## Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## Adding Services

1. Click "Add Service" on the dashboard
2. Enter service details:
   - Name (e.g., "Jellyfin")
   - Description (e.g., "Video and Audio Streaming")
   - URL (e.g., "https://cloud.example.com")
   - Choose an icon and color

## Project Structure

```
GhassiCloud/
├── frontend/
│   ├── public/           # Static assets & PWA icons
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── context/      # React context (Auth, Theme)
│   │   ├── pages/        # Page components
│   │   └── styles/       # CSS styles
│   └── vite.config.js    # Vite configuration
├── backend/
│   ├── src/
│   │   ├── db/           # Database setup
│   │   ├── middleware/   # Express middleware
│   │   └── routes/       # API routes
│   └── data/             # SQLite database
└── package.json          # Root package.json
```

## Future Features

- [ ] SSO Integration (Keycloak, Authentik, Authelia)
- [ ] Service health checks
- [ ] Real-time metrics from Prometheus/Grafana
- [ ] Custom dashboard widgets
- [ ] Service categories/grouping
- [ ] Drag-and-drop service ordering
- [ ] Import/Export configuration
- [ ] Multi-user support with permissions

## License

MIT
