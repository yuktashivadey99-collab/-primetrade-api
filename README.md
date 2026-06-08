# PrimeTrade API

A REST API built for the PrimeTrade.ai backend internship assignment. Covers JWT auth, role-based access, and full CRUD for tasks — with a small frontend UI to interact with everything.

Stack: Node.js, Express, SQLite, JWT, Swagger

---

## Getting Started

```bash
npm install
npm start
```

Server runs at `http://localhost:5000`

- Frontend → http://localhost:5000
- Swagger docs → http://localhost:5000/api-docs
- Health check → http://localhost:5000/api/v1/health

There's a default admin account seeded on first run:
- Email: `admin@primetrade.ai`
- Password: `Admin@1234`

---

## Project Structure

```
primetrade-api/
├── server.js              # entry point
├── .env                   # config (PORT, JWT_SECRET, DB_PATH)
├── public/                # vanilla JS frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
└── src/
    ├── config/swagger.js         # OpenAPI spec
    ├── controllers/
    │   ├── authController.js
    │   └── taskController.js
    ├── database/db.js            # SQLite setup + schema
    ├── middleware/
    │   ├── auth.js               # JWT verify + RBAC
    │   ├── errorHandler.js
    │   └── validate.js
    └── routes/
        ├── authRoutes.js         # /api/v1/auth
        └── taskRoutes.js         # /api/v1/tasks
```

---

## API Routes

All routes are prefixed with `/api/v1`.

**Auth**
```
POST   /auth/register         no auth needed
POST   /auth/login            returns JWT
GET    /auth/me               your profile (auth required)
GET    /auth/users            list all users (admin only)
PATCH  /auth/users/:id/role   change a user's role (admin only)
DELETE /auth/users/:id        remove a user (admin only)
```

**Tasks**
```
GET    /tasks                 your tasks (admin sees all)
GET    /tasks/:id             single task
POST   /tasks                 create task
PUT    /tasks/:id             update task
DELETE /tasks/:id             delete task
GET    /tasks/stats           aggregate stats (admin only)
```

---

## Database

Two tables — kept it simple since SQLite is fine for this scale.

```sql
users (
  id TEXT PRIMARY KEY,       -- UUID v4
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,             -- bcrypt, cost 12
  role TEXT DEFAULT 'user',  -- 'user' or 'admin'
  is_active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
)

tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',    -- pending | in_progress | completed | cancelled
  priority TEXT DEFAULT 'medium',   -- low | medium | high
  due_date TEXT,
  user_id TEXT,              -- FK to users
  created_at TEXT,
  updated_at TEXT
)
```

---

## Security

- Passwords hashed with `bcryptjs` (cost factor 12)
- JWT signed with HS256, expires in 7 days
- All inputs validated with `express-validator` — checked before they hit the controller
- Parameterized queries throughout, so no SQL injection risk
- `helmet` for security headers, `cors` configured, body size capped at 10kb
- Admin routes protected by a separate `authorize('admin')` middleware check

I went with SQLite + `better-sqlite3` instead of Postgres to keep setup zero-friction. Swapping to Postgres later is straightforward since the query style is the same.

---

## Scaling this up

Right now it's a single Express server with SQLite. To take this to production:

- **Database** — swap to PostgreSQL with connection pooling
- **Caching** — Redis for token blacklisting and repeated queries
- **Scaling** — JWT is stateless so horizontal scaling behind Nginx is easy
- **Containers** — Docker + docker-compose to package Node + DB + Redis together
- **Logging** — replace `morgan` with structured Winston logs, ship to something like Datadog
- **Rate limiting** — `express-rate-limit` to prevent abuse on auth endpoints

---

## Docs

Swagger UI is live at `/api-docs` while the server is running.

You can also import `postman_collection.json` into Postman — it has all endpoints with example bodies and auto-saves the JWT after login so you don't have to copy-paste it.

---

## Quick test with curl

```bash
# register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"Alice@123"}'

# login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Alice@123"}'

# create a task (swap TOKEN for the JWT from login)
curl -X POST http://localhost:5000/api/v1/tasks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"finish assignment","priority":"high","status":"in_progress"}'
```
