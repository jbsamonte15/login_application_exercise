# BPI Records Manager — Local Full-Stack Technical Exam App

A local-first implementation of the supplied exam requirements:
- React frontend with a login page
- Node.js AWS Lambda backend using Serverless Framework
- SQL persistence with MySQL
- Add, list, edit, delete, search, and filter records
- Docker Compose database and local Lambda API via `serverless-offline`

The PDF does not specify the record schema, so this sample uses **Contact Records**: first name, last name, email, phone, status, and notes.

## Prerequisites

Install:
- Node.js 20 or newer (Node.js 22 recommended)
- npm
- Docker Desktop (running)

## 1. Start MySQL

From the project root:

```bash
docker compose up -d db
```

The database initializes automatically using `database/init.sql`. To check:

```bash
docker compose ps
docker compose logs db
```

MySQL is exposed on `localhost:3307` to avoid colliding with a local MySQL service.

## 2. Start the backend (terminal 1)

```bash
cd backend
npm install
cp .env.example .env
npm run offline
```

Windows Command Prompt users can run `copy .env.example .env` instead of `cp`.
The API starts at `http://localhost:3001`.

The Lambda handlers use the same MySQL database in local Serverless Offline mode. The `serverless.yml` also defines the functions as AWS Lambda + HTTP API routes for cloud deployment.

## 3. Start the React frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Demo login

- **Email:** `admin@example.com`
- **Password:** `Password123!`

This demo account is seeded on backend startup if it does not already exist. Change it before using the app beyond a local demo.

## App walkthrough

1. Log in with the demo credentials.
2. Create a contact using **Add record**.
3. Use the search field to search name, email, phone, or notes.
4. Use the status filter to filter Active / Inactive records.
5. Select **Edit** to update a record.
6. Select **Delete** and confirm to remove a record.
7. Use **Logout** to return to the login page.

## API endpoints

All record endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Log in |
| GET | `/api/records?q=&status=` | List, search, and filter |
| POST | `/api/records` | Add record |
| PUT | `/api/records/{id}` | Edit record |
| DELETE | `/api/records/{id}` | Delete record |
| GET | `/api/health` | Health check |

## SQL/database notes

- MySQL runs in Docker and persists data in the `mysql_data` named volume.
- Table creation and sample admin seeding are handled by the Lambda initialization logic.
- To reset the demo database (this deletes local database data):

```bash
docker compose down -v
docker compose up -d db
```

## Screen recording deliverable

The exam asks for a screen recording showing the system working. This project package cannot record your desktop automatically. After launching the app, record a short walkthrough with Xbox Game Bar (`Win + Alt + R`), OBS Studio, or another screen recorder. Demonstrate login, add, search/filter, edit, and delete. Keep the recording with your submission.

## Troubleshooting

- **Docker connection error:** Start Docker Desktop and wait until its engine is running.
- **Port 3307 is occupied:** Change the host-side port in `docker-compose.yml` and update `DB_PORT` in `backend/.env`.
- **Port 3001 is occupied:** Change the `--port 3001` argument in `backend/package.json` and update `VITE_API_URL` in `frontend/.env`.
- **CORS issue:** The local API allows Vite's `http://localhost:5173` origin.
- **Database not ready:** Run `docker compose logs -f db`; once MySQL is healthy, restart `npm run offline`.

## Production/security notes

This is an exam/demo starter, not a production-ready deployment. Set a strong `JWT_SECRET`, use HTTPS, use a managed SQL database such as RDS for cloud deployment, configure least-privilege DB credentials, and add rate limiting, password reset, audit logging, and deployment-specific secret management before production use.
"# login_application_exercise" 
