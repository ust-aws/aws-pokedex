# Frontend

The frontend uses Next.js, React, Tailwind CSS, and shadcn/ui with the Base UI Maia theme.
The production build creates static files for S3 website hosting.

## Local development

Use Node.js 24.

1. From the repository root, install the dependencies:
   ```sh
   npm install
   ```
2. Copy the frontend environment example:
   ```sh
   cp frontend/.env.example frontend/.env.local
   ```
3. Configure and start the backend as described in `backend/README.md`.
4. Start both applications from the repository root:
   ```sh
   npm run dev
   ```
5. Open `http://localhost:3001`.

The API uses port 5000. Its `CORS_ORIGIN` must permit `http://localhost:3001`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API origin, such as `http://localhost:5000`. Required for API requests. |
| `NEXT_PUBLIC_IMAGES_BASE_URL` | Public S3 image origin for future Pokémon pages. |

Next.js includes these public values in the browser bundle at build time.
After an environment change, restart the development server or rebuild the export.
Keep secrets out of these variables.

## Authentication

`/login` accepts an email and password. `/register` also requires a username and a password with at least eight characters.
Both pages start a session and open `/` after success.
Authenticated visitors to either page return to `/`.

The browser stores the token under `pokedex.token` in `localStorage`.
The auth provider reads the current user through `/auth/me` at startup and on protected route changes.
Protected content stays hidden until validation completes.
If the API is unavailable, the token remains available and the page offers Retry and Log out.

The shared API client adds `Authorization: Bearer` to protected requests.
A protected 401 clears the token. The route guard then opens `/login`.
Public login errors stay on the form. Other request errors preserve the session.
Logout clears the session across browser tabs.

`/` requires authentication. `/admin` requires the current admin role.
The guards control navigation. The backend enforces access permissions.
These routes contain initial page shells. Pokémon features and user management belong to separate issues.

## Shared components

Use the generated shadcn components from `components/ui`.
The application wrappers are:

- `Modal`: controlled `open` and `onOpenChange`, required title and description, and content as children.
  Escape, the close button, and a backdrop click close it.
  Pass the trigger ref as `finalFocus` to restore focus after an external control opens the modal.
- `SearchBar`: `value`, `onSearch`, and an optional placeholder. It emits the latest text after 300 ms.
  List pages must keep the value in the URL and reset the page to 1 after a search change.
  Parent value changes cancel pending input, including browser Back navigation.
- `Pagination`: `total`, `page`, `pageSize`, and `onPageChange`. Pass the API values, with a page size of 20.
  It shows Previous, Next, and the page count. It hides controls for zero or one page.

For future URL-based list controls, put `useSearchParams` consumers inside a `Suspense` boundary.

## Verification

From the repository root, run:

```sh
npm test -w frontend
npm run lint -w frontend
npm run typecheck -w frontend
npm run build -w frontend
```

The tests use Vitest, jsdom, and React Testing Library.
They cover session changes, redirects, API errors, auth forms, debounce, pagination, and modal behavior.

The production command uses Webpack and the Tailwind PostCSS adapter.
Turbopack cannot open its internal CSS loader port in the restricted development environment.
The existing Turbopack development configuration remains available.
The build needs network access to download the existing Google Fonts.

The export contains `frontend/out/index.html`, plus `login/index.html`, `register/index.html`, and `admin/index.html`.
Cache Components and Partial Prefetching are disabled because Next.js rejects Partial Prerendering in export mode.

To serve the export locally:

```sh
python3 -m http.server 3001 --directory frontend/out --bind 127.0.0.1
```

With the API available, do these browser checks:

1. Open `/register/` directly and register a new account.
2. Make sure that the home page shows the account username.
3. Refresh the page and make sure that the session remains active.
4. Log out, then log in with the same account.
5. Submit an incorrect password and make sure that the login page shows the API error.
6. Register the same email or username and make sure that both fields show the conflict error.
7. As a regular user, open `/admin/` and make sure that the app opens `/`.
8. As a seeded admin, open `/admin/` and refresh the page.
9. Open another browser tab, then log out and make sure that both tabs clear the session.
10. With a saved session, stop the API and refresh. Make sure that Retry preserves the session after the API restarts.

The trailing-slash configuration gives S3 a directory index for each page.
No Next.js server is required in production. `next start` does not serve this static export.
