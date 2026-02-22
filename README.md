# Bank Simulation App

A small banking simulation with **registration**, **login**, **JWT in cookie**, **check balance**, and **send money**.

## Flow

1. **Register** → User stored in `users` table (email, password hash, full name, initial balance 1000).
2. **Login** → One JWT is generated, stored in `tokens` table, and set as an **httpOnly cookie** on the client.
3. After login → User sees **Check Balance** and **Send Money**.
4. **Check Balance** → Request goes to backend with the cookie (JWT); backend validates token (and DB), returns balance.
5. **Send Money** → Same auth; transfer between users by email.

## Database (SQLite)

- **users**: `id`, `email`, `password_hash`, `full_name`, `balance`, `created_at`
- **tokens**: `id`, `user_id`, `token`, `created_at`

## Run

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

- **Register** first, then **Log in**.
- Use **Check Balance** (sends JWT via cookie) and **Send Money** (recipient by email).

## API

| Method | Path           | Auth   | Description                    |
|--------|----------------|--------|--------------------------------|
| POST   | /api/register  | No     | Register (fullName, email, pwd)|
| POST   | /api/login     | No     | Login; sets `bank_token` cookie|
| POST   | /api/logout    | No     | Clears cookie                  |
| GET    | /api/me        | Cookie | Current user                   |
| GET    | /api/balance   | Cookie | Balance                        |
| POST   | /api/send-money| Cookie | toEmail, amount                |

All authenticated requests send the JWT via the `bank_token` cookie (`credentials: 'include'` in the frontend).
