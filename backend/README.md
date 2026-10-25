# Backend

Use Node.js 24 and the PostgreSQL service from the root Docker Compose file.

## Local development

1. From the repository root, install the dependencies:
   ```sh
   npm install
   ```
2. Start PostgreSQL:
   ```sh
   docker compose up -d db
   ```
3. Create the local environment file:
   ```sh
   cp backend/.env.example backend/.env
   ```
4. Apply the migrations:
   ```sh
   npm run db:migrate -w backend
   ```
5. Create an admin:
   ```sh
   npm run seed:admin -w backend -- admin@example.com 'local-demo-password'
   ```
6. Start the API:
   ```sh
   npm run dev -w backend
   ```

The API uses port 5000 unless `PORT` specifies another port.
`GET /health` returns `{ "ok": true }` after a successful database query.
`CORS_ORIGIN` specifies the permitted browser origin. Without this variable, the API does not permit requests across origins.

The seed script uses the normalized email address as the username.
It requires a password with at least eight characters and stores a salted scrypt hash.
A duplicate active email or username causes an error. The script does not change an existing user.
The login endpoint belongs to issue #3.

## Tests

With PostgreSQL available, run these commands from the repository root:

```sh
npm test -w backend
npm run typecheck -w backend
```

The harness creates `pokedex_test` and applies the migrations automatically.
The database user needs permission to create this database unless it already exists.
The harness clears the `users` and `pokemon` tables before each test.
Tests run sequentially because they share these tables.

`TEST_DATABASE_URL` overrides the test connection. Its database name must be `pokedex_test`.
Without this variable, the harness uses `DATABASE_URL` with the database name changed to `pokedex_test`.
Without either variable, it uses the local Docker Compose credentials.

Future integration test files can import `app`, `db`, and `pool` from `test/setup.ts`.
This import selects the test database before the application loads.

## Shared helpers

Routes use `validateBody(schema, req)` and `validateQuery(schema, req)` from `src/validation.ts`.
These functions return parsed Zod data and throw `HttpError(400, message)` for invalid input.
The query helper supports coercion and defaults without changing the Express query object.

`HttpError` carries an HTTP status and a public error message.
The error handler returns `{ "error": string }` and hides unexpected error details.
`hashPassword` and `verifyPassword` from `src/password.ts` share the password format for the seed script and authentication.

`src/app.ts` exports the application without opening a port.
`src/server.ts` starts the HTTP listener.
