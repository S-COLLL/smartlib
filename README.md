# 📚 SMARTLIB — Immersive 3D Library Management System

A full-stack library management platform with an immersive, animated frontend (HTML5, CSS3, vanilla JavaScript) and a Node.js/Express backend backed by **MySQL** (core relational data: users, members, books, categories, shelves, loans, reservations, fines, payments) and **MongoDB** (reviews, activity logs, notifications, search history).

---

## 1. Project structure

```
smartlib/
├── .env                        # environment variables (see §3) — never committed
├── .env.example
├── package.json
├── README.md
├── render.yaml                 # Render deployment blueprint
├── database/
│   ├── mysql/
│   │   ├── schema.sql           # full relational schema (CREATE DATABASE + tables)
│   │   ├── seed.js              # seeds MySQL with demo users/members/books/loans/...
│   │   └── seed-books.js
│   └── mongodb/
│       └── seed.js              # seeds MongoDB reviews/activity/notifications/search history
├── backend/
│   ├── server.js                # Express app entry point: REST API + serves /frontend
│   ├── config/
│   │   ├── db.js                 # MySQL connection pool (mysql2)
│   │   └── mongodb.js            # Mongoose connection
│   ├── models/                   # Mongoose models: ActivityLog, Notification, Review, SearchHistory
│   │   └── mongodb/               # (legacy duplicate schemas used only by database/mongodb/seed.js)
│   ├── routes/                   # one router per /api/* resource (auth, books, categories, shelves,
│   │                              # members, loans, reservations, fines, reviews, notifications,
│   │                              # activity, stats, search, upload)
│   ├── middleware/                # auth (JWT + role checks), validate, centralized errorHandler
│   ├── services/                  # bookService (featured/search/location logic)
│   ├── scripts/                   # add-book.js (CLI helper)
│   ├── data/                      # static JSON reference data (books/categories/shelves)
│   └── utils/                     # helpers, fineCalculator
└── frontend/
    ├── index.html, login.html, register.html, dashboard.html, books.html, book-details.html,
    │   book-form.html, admin-books.html, admin-dashboard.html, member-dashboard.html,
    │   members.html, member-form.html, shelves.html, library-map.html, map.html,
    │   issue-return.html, transactions.html, reservations.html, fines.html, reviews.html,
    │   my-books.html, my-reviews.html, notifications.html, profile.html, activity-logs.html
    ├── assets/                    # logo.svg, images
    ├── css/                       # main.css imports variables/base/layout/components/
    │                              # 3d-effects/pages/responsive.css
    └── js/                        # api.js, auth.js, components.js, navigation.js, modal.js,
                                   # toast.js, validation.js, pagination.js, format.js, 3d-effects.js
```

> Note: `backend/models/mongodb/` duplicates the schemas in `backend/models/` with slightly different field names. Only `database/mongodb/seed.js` uses the `mongodb/` subfolder; every API route uses the top-level `backend/models/*.js` versions. This is pre-existing and worth reconciling if you touch reviews/activity/notifications/search.

## 2. Requirements

- **Node.js 18+**
- **MySQL 8+** (local or hosted)
- **MongoDB 6+** (local or Atlas)

## 3. Installation & running locally

```bash
cd smartlib
npm install

# Create your .env from the example and fill in MYSQL_PASSWORD, JWT_SECRET, etc.
cp .env.example .env

# Load the MySQL schema (creates the `smartlib` database + tables)
mysql -u root -p < database/mysql/schema.sql

# Seed demo data into both databases
npm run seed            # or: npm run seed:mysql / npm run seed:mongodb

# Start the server
npm start                # http://localhost:3000
```

`npm run dev` uses `nodemon` to restart on file changes.

## 4. Environment variables (`.env`)

See `.env.example` for the full list: `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MYSQL_HOST`/`MYSQL_PORT`/`MYSQL_USER`/`MYSQL_PASSWORD`/`MYSQL_DATABASE`, `MONGODB_URI`, `FINE_PER_DAY`, `LOAN_PERIOD_DAYS`, `MAX_ACTIVE_LOANS`, `LIBRARY_TIMEZONE`, `UPLOAD_DIR`.

## 5. Demo login credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartlib.com` | `Admin@123` |
| Librarian | `librarian@smartlib.com` | `Librarian@123` |
| Member | (seeded members, e.g. `rahul.sharma@example.com`) | `Member@123` |

## 6. API

All endpoints are prefixed with `/api` (and mirrored under `/api/v1`) and return JSON. Resources: `auth`, `books`, `categories`, `shelves`, `members`, `loans` (aliased as `issues`), `reservations`, `fines`, `reviews`, `notifications`, `activity`, `stats`, `search`, `upload`. See `backend/routes/` for the exact endpoints on each resource.

## 7. Deployment

`render.yaml` provisions a Render web service. Render does not host MySQL, so you'll need an external MySQL instance (e.g. PlanetScale, Aiven, or a managed MySQL add-on) in addition to MongoDB Atlas, and to set the corresponding `MYSQL_*` / `MONGODB_URI` env vars on the service.
