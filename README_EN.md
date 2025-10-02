# Xwawa — Web3 Lottery & Marketplace

## Overview
Xwawa is a full‑stack web application that combines a provably fair lottery experience with a lightweight marketplace for digital assets. It integrates on‑chain smart contracts and token economics with a modern, responsive frontend and an operational backend that provides REST APIs, persistence, and email services.

## Key Features
- Lottery: transparent prize drawing, prize tiers, and user history
- Marketplace: basic product listing and order lifecycle
- Wallet Integration: MetaMask, OKX Wallet; Web3 interaction from the browser
- Backend Services: Express APIs for health, lottery history, email verification & sending
- Persistence: MySQL2 connection pool with health checks and graceful shutdown
- Email: SMTP‑based mailing with optional IMAP append to "Sent"

## Architecture
- Frontend: HTML5, CSS3, Vanilla JavaScript (ES6+)
- Web3: Wallet onboarding and contract calls, QR code support
- Backend: Express + CORS + dotenv; routes for health, lottery, email & DB ping
- Database: MySQL2 connection pool, resilience settings, schema bootstrap for `lottery_records`
- Email: Nodemailer with STARTTLS/SMTPS and optional IMAP (imapflow) for sent items

### Project Structure (simplified)
```
Xwawa/
├── index.html, lottery.html, marketplace.html, about.html
├── css/              # styles
├── js/               # frontend logic (lottery, marketplace, wallet)
├── images/           # assets (svg/png)
├── server/           # backend API and services
│   ├── index.js      # Express API (health, lottery, claim/email update, mail test)
│   ├── db.js         # MySQL2 pool, health checks, graceful shutdown
│   ├── mailer.js     # SMTP sending + optional IMAP append
│   └── verify-smtp.js
├── docs/             # detailed documentation
└── README.md, README_EN.md
```

## Getting Started
### Prerequisites
- Node.js 18+
- Modern browser (Chrome/Firefox/Safari)
- A local web server for serving static frontend pages

### Backend (API)
1. Configure environment variables (.env): DB (optional), SMTP (required for email)
2. Start API server:
```
node server/index.js
```
- Default port: `3001` (configurable via `PORT`)
- Health check: `GET /api/health`

### Frontend
Serve the project root with any static server (e.g., `python -m http.server 8002`), then visit `http://localhost:8002`.

## Environment Variables
Database (optional):
```
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
```
SMTP (required for sending emails):
```
SMTP_HOST=
SMTP_PORT=587     # 465 for SMTPS
SMTP_USER=
SMTP_PASS=
SMTP_AUTH_METHOD= # optional, e.g. LOGIN/PLAIN
```
IMAP (optional, append raw email to "Sent"):
```
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=        # defaults to SMTP_USER
IMAP_PASS=        # defaults to SMTP_PASS
IMAP_SECURE=true
IMAP_SENT_FOLDER=Sent
```

## API Overview
- Health: `GET /api/health`
- DB Ping & Version: `GET /api/db/ping`
- Lottery History: `GET /api/lottery/history?address=0x...&limit=30`
- Record Draw Result: `POST /api/lottery/draw`
- Update Winner Email (First/Second/Third prizes only): `POST /api/lottery/update-email`
- Claim Prize (First/Second/Third prizes only, duplicate‑claim prevention): `POST /api/lottery/claim`
- Email Utilities: `GET /api/mail/verify`, `POST /api/mail/send-test`

## Security & Operations
- Validate all inputs (addresses, emails)
- Restrict sensitive operations (claim/update) to eligible prize tiers
- CORS relaxed for localhost/127.0.0.1 (dev), adjust for production
- Graceful shutdown and periodic DB health checks
- Do not commit secrets: use `.env`, commit `.env.example` only

## Contributing
- Fork, branch, code, PR; adhere to ES6+ and modular code style
- Add docs and examples when introducing new modules

## License
MIT — see `LICENSE` for more details.