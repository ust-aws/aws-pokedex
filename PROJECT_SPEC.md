# aws-pokedex — Project Spec

The demo application for the S3 / EC2 / RDS lesson. Users upload Pokémon with an image. Admins also manage users.

## 1. Overview

### Roles

| Role | Pokémon | Users |
|---|---|---|
| `user` | Read all. Create. Update and delete **only their own**. | — |
| `admin` | Full CRUD on any Pokémon. | Read, search, update, soft-delete. |

### Pages

| Route | Who | Purpose |
|---|---|---|
| `/login` | public | Email + password login |
| `/register` | public | Self-signup (always creates role `user`) |
| `/` | logged in | Pokémon grid, search by name, filter by type, paging. Clicking a card opens a modal with the image and details. Create / edit / delete in modals. Edit and delete show only on Pokémon the user owns, or on every Pokémon for admins. |
| `/admin` | admin | User table: list, search, paging, edit (username, email, role, password), delete. |

## 2. Architecture

```
Browser ──HTTP──> S3 site bucket (Next.js static export)
   │
   ├──HTTP + Bearer JWT──> EC2 (Express API, systemd, port 80) ──> RDS Postgres (private)
   │                              └─ IAM instance role → signs presigned POST
   │
   └──presigned POST──> S3 images bucket (public GET on images/*)
```

- Only S3, EC2 and RDS are used, plus an IAM role and security groups.
- The frontend is static files. All logic and every permission check live in the API.
- The browser uploads images straight to S3. EC2 only signs the upload. It never handles the image bytes.

> [!WARNING]
> **Demo only.** The app uses plain HTTP, no domain and no CloudFront. The JWT and the passwords travel in clear text. Do not reuse real passwords. To harden it, put CloudFront (HTTPS) in front of both origins.

## 3. Decisions log

| Topic | Decision |
|---|---|
| Frontend hosting | Next.js `output: 'export'` → S3 static website bucket |
| Images | Separate S3 bucket. The browser uploads through a **presigned POST**. S3 enforces `content-length-range` ≤ 2 MB and content type `image/png`, `image/jpeg` or `image/webp`. Objects are publicly readable. |
| Auth | Email + password. JWT (HS256, 8 h expiry, no refresh token) sent as `Authorization: Bearer`. The browser keeps it in `localStorage`. |
| Signup | Public register creates role `user`. The first admin comes from a seed script. Admins can promote users. |
| Ownership | `pokemon.created_by`. A user can change only their own Pokémon. |
| Database | RDS PostgreSQL 17 + Drizzle ORM + drizzle-kit migrations |
| Deletes | Soft delete (`deleted_at`) for users and Pokémon. S3 objects are kept. |
| Search | Server-side `ILIKE` on name + `type` filter, 20 per page |
| Admin guardrails | An admin cannot delete or demote themselves |
| Provisioning | Manual AWS console runbook (§8) |
| EC2 runtime | Amazon Linux 2023, Node 24, systemd. No build step: Node runs `.ts` with native type stripping. |
| Secrets | `/etc/aws-pokedex.env` on EC2 (mode 600), loaded by systemd `EnvironmentFile` |
| Password hashing | `node:crypto` `scrypt` with a per-user salt (no extra dependency) |
| Validation | zod on every request body and query |
| Tests | `node:test` + `supertest` against a local Postgres (docker compose) |

## 4. Data model

All tables use `created_at` / `updated_at` (`timestamptz`, default `now()`). Soft-deleted rows have `deleted_at` set, and every normal query filters `deleted_at IS NULL`.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `email` | `text` not null | |
| `username` | `text` not null | display name |
| `password_hash` | `text` not null | `scrypt$<salt>$<hash>` |
| `role` | enum `user_role` (`user`, `admin`) | default `user` |
| `created_at`, `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` null | |

- Partial unique index on `lower(email)` `WHERE deleted_at IS NULL`.
- Partial unique index on `lower(username)` `WHERE deleted_at IS NULL`.
- A soft-deleted user cannot log in. Their Pokémon stay visible.

### `pokemon`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | not unique: two users can both upload Pikachu |
| `types` | `text[]` not null | 1–2 values from the 18 canonical types (check constraint) |
| `description` | `text` null | max 500 chars (zod) |
| `image_key` | `text` null | S3 key, e.g. `images/<uuid>.png` |
| `created_by` | `uuid` FK → `users.id` not null | |
| `created_at`, `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` null | |

- Index on `lower(name)`.
- Canonical types: normal, fire, water, electric, grass, ice, fighting, poison, ground, flying, psychic, bug, rock, ghost, dragon, dark, steel, fairy.

## 5. API

- Base URL: `http://<ec2-public-dns>` (no path prefix).
- JSON in and out. Errors use the shape `{ "error": string }` with status 400 / 401 / 403 / 404 / 409.
- CORS allows only `CORS_ORIGIN` (the S3 website URL).
- `requireAuth` verifies the JWT and then **re-reads the user from the DB** on every request. A demotion or soft delete therefore takes effect at once and does not wait for the token to expire.
- List endpoints return `{ items, total, page, pageSize }` with `pageSize = 20`.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ ok: true }` + DB ping |
| POST | `/auth/register` | public | `{email, username, password}` (password ≥ 8 chars) → `{token, user}` |
| POST | `/auth/login` | public | `{email, password}` → `{token, user}`. Wrong credentials → 401 with a generic message. |
| GET | `/auth/me` | auth | current user |
| GET | `/pokemon?q=&type=&page=` | auth | `q` → `name ILIKE %q%`, `type` → `type = ANY(types)` |
| GET | `/pokemon/:id` | auth | |
| POST | `/pokemon` | auth | `{name, types, description?, imageKey?}`. `created_by` = caller. |
| PATCH | `/pokemon/:id` | owner or admin | partial update |
| DELETE | `/pokemon/:id` | owner or admin | soft delete |
| POST | `/uploads/presign` | auth | `{contentType}` → `{url, fields, key}`. Key = `images/<uuid>.<ext>`. Expires in 5 min. |
| GET | `/users?q=&page=` | admin | `q` matches username or email |
| PATCH | `/users/:id` | admin | `{username?, email?, role?, password?}`. Changing your own role → 403. |
| DELETE | `/users/:id` | admin | soft delete. Deleting yourself → 403. |

User objects in responses never contain `password_hash`.

## 6. Frontend

- Next 16 App Router + Tailwind 4. **Read `frontend/AGENTS.md` first**: the bundled docs in `node_modules/next/dist/docs/` override training data.
- `next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`. Check that `cacheComponents` and `partialPrefetching` work with static export. Remove them if `next build` rejects them.
- Static-export limits (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`): no dynamic routes without `generateStaticParams`, no middleware/proxy, no cookies, no route handlers. As a result:
  - Create and edit happen in modals on `/`. There is no `/pokemon/[id]` route.
  - Route guards run client-side: redirect to `/login` if there is no token, and to `/` if a non-admin opens `/admin`. This is UX only. The API is the real enforcement.
- `frontend/lib/api.ts` is a single `fetch` wrapper. It adds the Bearer token, and on 401 it clears the token and redirects to `/login`.
- Upload flow: call `POST /uploads/presign`, then POST the file to S3 with the returned `fields`, then save `imageKey` on the Pokémon.
- Build-time env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_IMAGES_BASE_URL`.

### 6.1 Components (`frontend/components/`)

| Component | Used on | Behaviour |
|---|---|---|
| `SearchBar` | `/`, `/admin` | Text input, debounced 300 ms, calls `onSearch(q)`. Resets the page to 1. |
| `Pagination` | `/`, `/admin` | Prev / Next and "Page x of y", from the API's `{total, page, pageSize}`. Hidden when there is only one page. |
| `Modal` | all modals | Thin wrapper on the native `<dialog>` (`showModal()`). Esc and a backdrop click close it. |
| `PokemonCard` | `/` | Grid tile: image (placeholder if none), name, type badges. Click opens `PokemonDetailModal`. |
| `PokemonDetailModal` | `/` | Large image, name, types, description, creator, dates. Edit and Delete buttons show only for the owner or an admin. |
| `PokemonFormModal` | `/` | Create and edit: name, 1–2 types, description, image upload (presign → S3 POST → `imageKey`). |
| `UserTable` | `/admin` | Columns: username, email, role, created. Row actions: Edit (opens `UserFormModal`) and Delete (with confirm). Delete is disabled on your own row. |
| `UserFormModal` | `/admin` | Username, email, role (disabled for yourself), optional new password. |

- The search text, type filter and page number live in the URL (`?q=&type=&page=`), so refresh and the back button keep the view. With static export, `useSearchParams` needs a `<Suspense>` boundary.
- Both list pages show 20 items per page.

## 7. Repo layout (target)

```
docker-compose.yml               # local postgres:17 for dev + tests
PROJECT_SPEC.md
backend/
  .env.example
  drizzle.config.ts
  drizzle/                       # generated migrations
  scripts/seed-admin.ts          # creates first admin from env/args
  src/
    app.ts                       # express app, cors, json, routes, listen
    db/schema.ts                 # drizzle tables + enums
    db/index.ts                  # pg pool + drizzle client
    auth.ts                      # scrypt hash/verify, JWT sign/verify, requireAuth, requireAdmin
    routes/auth.ts
    routes/pokemon.ts
    routes/users.ts
    routes/uploads.ts
  test/*.test.ts
frontend/
  app/page.tsx                   # pokemon grid
  app/login/page.tsx
  app/register/page.tsx
  app/admin/page.tsx
  components/                    # see §6.1
  lib/api.ts
```

### Backend env vars (`backend/.env.example`)

| Var | Example |
|---|---|
| `DATABASE_URL` | `postgres://pokedex:pokedex@localhost:5432/pokedex` |
| `JWT_SECRET` | long random string |
| `PORT` | `5000` locally, `80` on EC2 |
| `CORS_ORIGIN` | `http://localhost:3001` locally, the S3 website URL in AWS |
| `AWS_REGION` | `ap-southeast-1` |
| `IMAGES_BUCKET` | `aws-pokedex-images-<suffix>` |

### Local dev

1. `docker compose up -d`
2. `cp backend/.env.example backend/.env`
3. The developer runs the migrations: `npx -w backend drizzle-kit migrate`
4. `node backend/scripts/seed-admin.ts admin@example.com <password>`
5. `npm run dev` (API on :5000, web on :3001)

For local image uploads, use a real dev S3 bucket with your own AWS profile. There is no S3 emulator.

## 8. AWS runbook (console)

Use one region throughout. Use the default VPC.

1. **Security groups**
   - `sg-api`: inbound TCP 80 from `0.0.0.0/0`, TCP 22 from *My IP*.
   - `sg-db`: inbound TCP 5432 from source `sg-api` only.
2. **RDS**: PostgreSQL 17, *Free tier* template, `db.t4g.micro`, 20 GB gp3, **Public access: No**, security group `sg-db`, initial database name `pokedex`. Write down the endpoint and the master password.
3. **S3 images bucket** `aws-pokedex-images-<suffix>`
   - Turn off *Block all public access*. This is needed for the bucket policy.
   - Bucket policy: `s3:GetObject` for `"Principal": "*"` on `arn:aws:s3:::<bucket>/images/*`.
   - CORS: allow `POST` from the S3 site origin (and `http://localhost:3001` for dev).
4. **IAM role** `pokedex-ec2` (trusted entity: EC2)
   - Inline policy: `s3:PutObject` on `arn:aws:s3:::<images-bucket>/images/*`.
5. **EC2**: Amazon Linux 2023, `t3.micro`, security group `sg-api`, IAM instance profile `pokedex-ec2`, key pair for SSH.
   - `sudo dnf install -y git nodejs24` (or install with nvm if that package is not available)
   - `git clone <repo> /opt/aws-pokedex && cd /opt/aws-pokedex && npm ci -w backend`
   - Write `/etc/aws-pokedex.env` (mode 600) with the env vars from §7. `DATABASE_URL` points to the RDS endpoint.
   - The developer runs the migrations and the seed script by hand from this instance.
   - systemd unit `/etc/systemd/system/aws-pokedex.service`:
     ```ini
     [Unit]
     Description=aws-pokedex API
     After=network-online.target

     [Service]
     WorkingDirectory=/opt/aws-pokedex/backend
     EnvironmentFile=/etc/aws-pokedex.env
     ExecStart=/usr/bin/node src/app.ts
     Restart=always
     User=ec2-user
     AmbientCapabilities=CAP_NET_BIND_SERVICE

     [Install]
     WantedBy=multi-user.target
     ```
   - `sudo systemctl enable --now aws-pokedex`
6. **S3 site bucket** `aws-pokedex-site-<suffix>`
   - Turn on static website hosting: index `index.html`, error `404.html`.
   - Turn off *Block all public access*. Bucket policy: `s3:GetObject` for `*` on `arn:aws:s3:::<bucket>/*`.
   - Build and upload from your machine:
     ```sh
     NEXT_PUBLIC_API_URL=http://<ec2-dns> \
     NEXT_PUBLIC_IMAGES_BASE_URL=https://<images-bucket>.s3.<region>.amazonaws.com \
     npm run build -w frontend
     aws s3 sync frontend/out s3://<site-bucket> --delete
     ```
   - Set `CORS_ORIGIN` on EC2 to the website endpoint `http://<site-bucket>.s3-website-<region>.amazonaws.com` and restart the service.
7. **Smoke test**
   - `curl http://<ec2-dns>/health` returns `{ ok: true }`.
   - Open the site URL, register, create a Pokémon with an image, then search for it.
   - Log in as the seeded admin. Open `/admin`, search for the new user and edit their role.
8. **Teardown** (to stop charges): terminate EC2, delete the RDS instance (skip the final snapshot), empty and delete both buckets, delete the IAM role and both security groups.

## 9. Testing

Integration tests with `node:test` + `supertest` run against the docker compose Postgres (separate `pokedex_test` DB, tables truncated between tests). They must cover:

- register → login → `/auth/me`
- 401 without a token or with a bad token
- a user cannot PATCH or DELETE another user's Pokémon (403). An admin can.
- a soft-deleted Pokémon disappears from the list and from `GET /pokemon/:id` (404)
- a soft-deleted user cannot log in, and their existing token stops working
- a non-admin gets 403 on `/users`
- an admin cannot delete or demote themselves (403)
- duplicate email at register → 409. Re-registering the email of a soft-deleted user succeeds.
- no response contains `password_hash`
- search (`q`, `type`) and paging

The `/uploads/presign` test only checks the response shape. It does not upload to S3.

## 10. Out of scope

HTTPS / custom domain, CloudFront, refresh tokens, password-reset email, image resizing or thumbnails, deleting S3 objects, infrastructure as code, CI/CD for the app (the participant image has its own workflow), audit logging, user profile page, rate limiting.
