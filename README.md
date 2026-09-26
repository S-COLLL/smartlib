# 📚 SmartLib — AI Powered Library Management System

A full-stack library management platform built with **HTML5, CSS3 and vanilla JavaScript (ES modules)** on the frontend and **Node.js, Express, MongoDB (Mongoose), JWT and bcrypt** on the backend. No React, no TypeScript, no build step.

Librarians can add a book with its price and exact shelf location (floor → section → shelf → rack → row → position), find it on an animated floor map, issue it, track the due date, calculate late fines automatically, collect payments (mock gateway), process returns and watch the dashboard update, all against a real MongoDB database.

---

## 1. Project structure

```
smartlib/
├── .env                      # environment variables (see §4)
├── .env.example
├── package.json              # one package for the whole app
├── README.md
├── backend/
│   ├── server.js             # Express app: REST API + serves /frontend
│   ├── config/db.js          # Mongoose connection
│   ├── models/               # User, Member, Book, Author, Category, Shelf, Issue, Return,
│   │                         # Reservation, Fine, Payment, Notification, Setting, Counter
│   ├── controllers/          # auth, book, catalog (authors/categories/shelves), member,
│   │                         # circulation (issues/returns/reservations), finance (fines/payments),
│   │                         # notification (+settings), report (+dashboard), ai
│   ├── routes/               # one router per /api/* resource
│   ├── middleware/           # auth (JWT + role checks), validate, error handler
│   ├── utils/                # helpers (IDs, dates), library bookkeeping, lookups
│   └── seed/                 # data.js (demo data) + seed.js
└── frontend/
    ├── index.html            # login / register
    ├── dashboard.html  books.html  book-details.html  authors.html  categories.html
    ├── shelves.html  members.html  issues.html  returns.html  reservations.html
    ├── fines.html  payments.html  reports.html  ai-assistant.html
    ├── notifications.html  settings.html
    ├── assets/logo.svg
    ├── css/  style.css (design system) · dashboard.css · books.css · responsive.css
    └── js/   app.js (shell, auth guard, UI kit) · api.js · icons.js · shared.js (modals,
              shelf route, QR, payment gateway) · charts.js · theme-init.js · login.js
              + one module per page (dashboard.js, books.js, shelves.js, members.js, …)
```

## 2. Installation

Requirements: **Node.js 18+** and **MongoDB 6+** (local or Atlas).

```bash
cd smartlib
npm install          # express, mongoose, jsonwebtoken, bcryptjs, cors, dotenv
npm run seed         # wipes & loads demo data into MongoDB
npm start            # http://localhost:5000
```

`npm run dev` restarts the server automatically on file changes (`node --watch`).

## 3. MongoDB setup

**Option A: local MongoDB (Windows)**
1. Install *MongoDB Community Server* from mongodb.com/try/download/community and tick “Install as a Service”.
2. It listens on `mongodb://127.0.0.1:27017`, which is the default in `.env`.

**Option B: MongoDB Atlas (cloud, free tier)**
1. Create a free cluster, add a database user and allow your IP under *Network Access*.
2. Copy the connection string into `.env`:
   `MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/smartlib`

Collections are created automatically on first use; `npm run seed` creates the indexes and demo data.

## 4. Environment variables (`.env`)

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port for API + frontend |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/smartlib` | MongoDB connection string |
| `JWT_SECRET` | *long random string* | Signs login tokens. **Change it.** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_ORIGIN` | `*` | CORS origins (comma-separated) if the frontend is hosted elsewhere |

## 5. Demo login credentials

| Role | Email | Password | Can do |
|---|---|---|---|
| Admin | `admin@smartlib.com` | `Admin@123` | Everything, incl. library policy & user accounts |
| Librarian | `librarian@smartlib.com` | `Librarian@123` | Catalogue CRUD, circulation, discounts/waivers |
| Staff | `staff@smartlib.com` | `Staff@123` | Issue/return, members, payments, move books |
| Student | `student@smartlib.com` | `Student@123` | Browse, reserve, renew own loans, own fines & payments, AI |

The login page has one-click buttons for each demo account. Students can also self-register, which creates a library membership automatically.

**Demo data:** 39 books (real ISBNs, prices in ₹, exact locations; *The Alchemist* is at Floor 1 → Fiction → Shelf A → Rack 03 → Row B → Position 07), 34 authors, 12 categories, 16 shelves on 3 floors, 18 members, 36 issue records (active, overdue, returned late, lost, damaged), 10 reservations, 10 fines, 15 payments and 25+ notifications.

## 6. API documentation

All endpoints are prefixed with `/api`, return JSON `{ success, data, … }` and, except login/register, need `Authorization: Bearer <token>`. Errors return `{ success: false, message, details? }` with 400/401/403/404/409 status codes. List endpoints accept `page` and `limit` and return `pagination`. Records can be addressed by Mongo `_id` **or** their readable code (`BK0001`, `MEM0001`, `SH-A`, `TXN00001`, `FIN00001`, `PAY00001`, `RES00001`).

| Method & path | Roles | Description |
|---|---|---|
| **Auth** `/api/auth` | | |
| `POST /register` | public | Student sign-up (creates User + Member) |
| `POST /login` | public | Returns JWT + user |
| `GET /me` · `PUT /profile` · `PATCH /password` | any | Current user |
| `POST /search-history` | any | Store a search term (used for recommendations) |
| `GET/POST /users`, `PATCH /users/:id` | admin | Manage accounts & roles |
| **Books** `/api/books` | | |
| `GET /` | any | Live search: `search` (name, ISBN, author, publisher, category, Book ID, shelf, rack, language), `status` (available·issued·reserved·overdue·lost·damaged), `category`, `author`, `language`, `floor`, `shelf`, `minPrice`, `maxPrice`, `sort` (az·za·newest·oldest·price_asc·price_desc·popular) |
| `GET /meta` | any | Filter options |
| `GET /recommendations?member=` | any | Personalised picks (history, categories, authors, searches, popularity) |
| `GET /:id` | any | Details + active loans, reservation queue, similar books (id / Book ID / ISBN) |
| `POST /` · `PUT /:id` · `DELETE /:id` | admin, librarian | CRUD (validates ISBN, shelf capacity, rack/row range) |
| `PATCH /:id/location` | staff+ | Move to another shelf/rack/row/position |
| `POST /bulk` | admin, librarian | `{action: delete·move·category, ids[]}` |
| **Authors / Categories / Shelves** | | `GET /`, `GET /:id` (any); `POST`, `PUT /:id`, `DELETE /:id` (admin, librarian). Shelf GET returns capacity, occupied, available space and the books stored |
| **Members** `/api/members` | | `GET /` (staff), `GET /:id` (staff or the member themselves: profile + loans, fines, payments, reservations), `POST`, `PUT /:id` (staff), `PATCH /:id/renew` (staff), `DELETE /:id` (admin, librarian) |
| **Issues** `/api/issues` | | `GET /` (`status` incl. `Active`, `search`, `from`, `to`), `GET /:id`, `POST /` `{member, book, dueDate?}` (staff; checks membership, limits, dues, availability), `PATCH /:id/renew` |
| **Returns** `/api/returns` | | `GET /lookup?q=` (transaction, member ID, book ID or ISBN → loans with computed days overdue & fine), `GET /`, `POST /` `{issue, condition: Good·Damaged·Lost, returnDate?, damageCharge?}` (creates fines, frees the copy, promotes the reservation queue) |
| **Reservations** `/api/reservations` | | `GET /`, `POST /` `{book, member?}`, `PATCH /:id/cancel`, `PATCH /:id/collect` (staff → issues the held copy), `DELETE /:id` |
| **Fines** `/api/fines` | | `GET /` (`status` incl. `Outstanding`), `GET /summary`, `POST /` (manual charge), `PATCH /:id/discount`, `PATCH /:id/waive` (admin, librarian), `DELETE /:id` (admin) |
| **Payments** `/api/payments` | | `GET /` (filters + totals), `GET /:id` (receipt), `POST /` `{fine? or member+reason, amount, method: Cash·UPI·Card·Bank Transfer, status?: Paid·Pending}` (staff), `PATCH /:id/confirm` |
| **Notifications** `/api/notifications` | | `GET /` (`type`, `unread`), `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`, `POST /` (staff broadcast), `DELETE /:id` |
| **Reports** `/api/reports` | | `GET /dashboard` (all live stats & chart series), `GET /` (list), `GET /:type` with type = books·issued·returned·overdue·fines·payments·members·popular·shelves (`from`, `to` where relevant) |
| **Settings** `/api/settings` | | `GET /`, `PUT /` (admin): fine/day, loan days, renewals, limits, hold days, lost fee, damage %, membership fee |
| **AI** `/api/ai/query` | any | `POST {message}` → natural-language answer + matching books / loans |

## 7. Features implemented

- **Design system**: navy structure, teal actions, gold highlights, status-only reds/greens; Inter font; 16/10/18px radii; the specified shadows; carefully tuned **dark mode** (not inverted) with an animated circular theme transition. Chart colours are checked for colour-blind safety in both themes.
- **Dashboard**: 10 animated counter cards (total, available, issued, reserved, overdue books; total and active members; total fines; money collected; books added recently); issued-vs-returned line chart, monthly fines-vs-collected bars, popular books, category distribution, shelf occupancy, recent transactions, overdue list, recent members, new books and **Recommended for you**. All figures come from MongoDB; nothing is hard-coded.
- **Books**: every requested field incl. prices, copy counters, status, date added/updated; table **and** grid views; live search across 9 fields; status chips; category/language/floor filters; 7 sort orders; sortable headers; pagination; bulk move, category change, CSV export and delete; add/edit form with cover upload (or automatic cover by ISBN) and location picker limited to the shelf's racks and rows.
- **Exact location & “Find on shelf”**: a location card with six steps, plus an animated SVG floor plan that draws a route from the entrance to the target shelf, a rack/row diagram with the position pinned, and step-by-step directions.
- **Interactive shelf map**: floor tabs, sections with shelf tiles coloured by occupancy (teal <50%, blue, gold ≥80%, red full), selection glow and an animated detail panel (capacity, occupied, available, █░ bar, books with rack·row·position, move-book action), shelf CRUD and shelf QR codes.
- **Circulation**: issuing with eligibility checks (membership status, expiry, book limit, dues limit, availability); available copies go down 1 on issue and up 1 on return. Renewals (blocked when overdue, at the renewal limit, or when others are queued). Returns look up by transaction, member, book ID or ISBN, show days overdue live, and calculate the fine automatically (₹10/day × days, plus damage % or lost = price + processing fee). Reservation queue with automatic holds and pickup expiry.
- **Money**: fines with original / discount / paid / waived / remaining and a status; manual charges; mock payment gateway (Cash, UPI with QR, Card, Bank Transfer with Pending→Confirm); partial payments; printable receipts; payment history per member; all amounts in ₹.
- **Members**: profiles with photo, loans, history, fines, payments and reservations; renew membership (records the fee); Active / Expired / Suspended statuses; expiry tracking.
- **Notifications**: generated automatically for issue, due soon, overdue, fine, payment, reservation ready, membership expiring and new book; animated badge; dropdown panel; full page with filters; staff broadcast. An hourly maintenance job also marks loans overdue and expires memberships and reservations.
- **AI assistant** (rule-based NLP over live data): “Where is The Alchemist?”, “Show science books under ₹500”, “Find available books by Chetan Bhagat”, “Which books are overdue?”, “Show books available on Floor 2”, plus price ranges, languages, shelf/rack, popular, new arrivals, statistics, and “my books / my fines”. Typing animation, gold location path, and a button to show the route.
- **Recommendations** based on borrowing history (categories, authors), search history and popularity, each with a reason label.
- **Reports**: 9 reports with date ranges, **Print**, **CSV** and **PDF** (jsPDF) export.
- **QR / barcode**: book QR codes (open the book's details page), ISBN barcodes, shelf QR codes (open the shelf's capacity and contents), and an in-app camera scanner with manual code entry.
- **Auth**: JWT, bcrypt hashing, protected pages, role-based API authorisation (admin, librarian, staff, student) and student-scoped data.
- **UX**: page transitions, staggered card entrances, sidebar collapse, skeleton loaders, toasts, modal and dropdown animations, validation messages next to fields, empty and error states, keyboard shortcuts (Ctrl K or `/` for search), `prefers-reduced-motion` support.
- **Responsive**: off-canvas sidebar with overlay on tablet and mobile, bottom-sheet modals, horizontally scrolling tables, 40px+ touch targets; checked at 390px wide with no horizontal overflow.

## 8. Running the frontend

The Express server serves the frontend, so after `npm start` open **http://localhost:5000**. No separate step is needed.

If you prefer VS Code *Live Server* (port 5500), keep the backend running on port 5000; the frontend then calls `http://localhost:5000/api` automatically. For any other host, run `localStorage.setItem('smartlib-api', 'http://your-host:5000')` in the browser console.

## 9. Running the backend

```bash
npm start        # production mode
npm run dev      # auto-restart on changes
npm run seed     # reset demo data (DELETES existing data)
```

Health check: `GET http://localhost:5000/api/health`.

## 10. Known limitations

- **Payments are simulated.** No real gateway is contacted; UPI QR codes and card fields are for demonstration only.
- **The AI assistant is rule-based** (regex and keyword parsing over MongoDB), not a large language model. It handles the documented question patterns well; free-form questions fall back to a keyword search.
- **bcryptjs** (a pure-JavaScript bcrypt) is used instead of the native `bcrypt` package so that `npm install` works on Windows without build tools. The hashes are standard bcrypt.
- **CDN assets need internet**: Chart.js, qrcode.js, JsBarcode, jsPDF and html5-qrcode load from cdnjs, the Inter font from Google Fonts, and covers from Open Library. When offline, covers fall back to generated designs and the core CRUD still works.
- **Camera scanning** needs HTTPS or `localhost` and camera permission; otherwise use manual code entry.
- **Uploaded images** (covers, photos) are resized and stored as data URLs in MongoDB (≈30–60 KB each). That is fine for a college project, but a real deployment should use object storage.
- **Notifications are in-app only** (the badge refreshes every 60 s); there is no email or SMS delivery.
- **PDF exports** show “Rs.” instead of “₹” because jsPDF's built-in fonts lack the rupee glyph.
- There is no automated test suite in the repository. The flows were verified manually with a scripted API walkthrough and browser checks.
