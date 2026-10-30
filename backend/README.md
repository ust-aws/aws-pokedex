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
4. Generate a JWT secret:
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
5. Set `JWT_SECRET` in `backend/.env` to the generated value.
6. Apply the migrations:
   ```sh
   npm run db:migrate -w backend
   ```
7. Create an admin:
   ```sh
   npm run seed:admin -w backend -- admin@example.com 'local-demo-password'
   ```
8. Start the API:
   ```sh
   npm run dev -w backend
   ```

The API uses port 5000 unless `PORT` specifies another port.
`GET /health` returns `{ "ok": true }` after a successful database query.
`CORS_ORIGIN` specifies the permitted browser origin. Without this variable, the API does not permit requests across origins.

The seed script uses the normalized email address as the username.
It requires a password with at least eight characters and stores a salted scrypt hash.
A duplicate active email or username causes an error. The script does not change an existing user.
The seeded admin can use the login endpoint.

## Authentication

`POST /auth/register` accepts `{email, username, password}` and returns status 201 with `{token, user}`.
Registration always creates the `user` role. A password needs at least eight characters.
`POST /auth/login` accepts `{email, password}` and returns status 200 with `{token, user}`.
Wrong credentials return a generic 401 error.
`GET /auth/me` requires `Authorization: Bearer <token>` and returns `{user}`.

Public users contain only `id`, `email`, `username`, and `role`.
Emails are trimmed and converted to lowercase. Usernames are trimmed. Passwords retain all characters, including spaces.
Duplicate active emails or usernames return 409. Invalid request bodies return 400.

The API uses `jose` to sign HS256 tokens with an eight-hour expiry.
`JWT_SECRET` must contain at least 32 UTF-8 bytes. The application rejects missing or shorter values before it starts.
Changing the secret invalidates existing tokens.
Authentication reads the active user from PostgreSQL on every request.
Role changes and account deletion take effect on the next request.
Deleted accounts cannot log in. Their email and username can be registered again.

## Image uploads

`POST /uploads/presign` requires `Authorization: Bearer <token>` and accepts `{contentType}`.
It returns `{url, fields, key}`. The key has the form `uploads/<userId>/<uuid>.<ext>`.
Only `image/png`, `image/jpeg`, and `image/webp` are accepted. Other types return 400.

The browser posts the file directly to S3. It sends every entry in `fields` as a form field and then the file as the last field, named `file`.
The API signs the upload but never receives the image.
S3 rejects files larger than 2 MB, a different content type, and permits older than five minutes.
Files under `uploads/` are private.

After the upload, the client calls `POST /uploads/confirm` with `{key}`.
The API reads the file's first 12 bytes and checks that they match the PNG, JPEG, or WebP signature for the key's extension.
A valid file is copied to `images/<uuid>.<ext>`, which is public, and the response is `{key}` with that new key.
The client saves the returned key as the Pokémon's `imageKey`.
A file that fails the check is deleted and returns 400. A key that belongs to another user returns 400. A missing upload returns 404.

Each user can request 20 upload permits per hour. Further requests return 429.
The counter is in memory, so it resets when the API restarts.
Unconfirmed uploads are deleted by the bucket's lifecycle rule (see step 5 below).

The AWS SDK uses the default credential provider chain.
Locally, it uses your AWS CLI profile. On EC2, it uses the instance role. Do not put AWS keys in `.env`.
Set `AWS_REGION` and `IMAGES_BUCKET` in `backend/.env`.

### Images bucket setup

Use the same region as `AWS_REGION`. Replace `<bucket>` with a globally unique name such as `aws-pokedex-images-<suffix>`.

1. Create the bucket and turn off *Block all public access*. The public-read policy requires this.
   ```sh
   aws s3api create-bucket --bucket <bucket> --region ap-southeast-1 --create-bucket-configuration LocationConstraint=ap-southeast-1
   aws s3api delete-public-access-block --bucket <bucket>
   ```
2. Allow public reads on `images/*` only. Save this as `policy.json`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::<bucket>/images/*"
     }]
   }
   ```
   ```sh
   aws s3api put-bucket-policy --bucket <bucket> --policy file://policy.json
   ```
3. Allow browser uploads from the frontend origins. Save this as `cors.json`:
   ```json
   {
     "CORSRules": [{
       "AllowedMethods": ["POST"],
       "AllowedOrigins": ["http://localhost:3001", "http://<site-bucket>.s3-website-ap-southeast-1.amazonaws.com"],
       "AllowedHeaders": ["*"]
     }]
   }
   ```
   ```sh
   aws s3api put-bucket-cors --bucket <bucket> --cors-configuration file://cors.json
   ```
   In the console, paste only the array inside `CORSRules`.
4. The identity that signs uploads needs the following policy. On EC2, attach it to the instance role.
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::<bucket>/uploads/*"
       },
       {
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::<bucket>/images/*"
       },
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::<bucket>"
       }
     ]
   }
   ```
   Without `s3:ListBucket`, S3 returns `AccessDenied` instead of `NoSuchKey` for a missing upload, and `/uploads/confirm` returns 500 instead of 404.
5. Delete unconfirmed uploads automatically. Save this as `lifecycle.json`:
   ```json
   {
     "Rules": [{
       "ID": "expire-unconfirmed-uploads",
       "Filter": { "Prefix": "uploads/" },
       "Status": "Enabled",
       "Expiration": { "Days": 1 }
     }]
   }
   ```
   ```sh
   aws s3api put-bucket-lifecycle-configuration --bucket <bucket> --lifecycle-configuration file://lifecycle.json
   ```
   The rule deletes anything under `uploads/` one day after it was uploaded. This covers files that were uploaded but never confirmed.
   Confirmed images under `images/` are not affected.
   S3 runs lifecycle rules once a day, so a file can remain for up to about 48 hours.
   This command replaces any existing lifecycle rules on the bucket.

Without the CORS rule, browser uploads fail even though `curl` uploads succeed.

To check the setup, request a permit and post a small image with `curl -F`, sending each entry in `fields` and then `file=@image.png`.
S3 returns 204. Then call `/uploads/confirm` with the key. The image is readable at `https://<bucket>.s3.<region>.amazonaws.com/<key>` using the returned key.
A file over 2 MB returns 400 `EntityTooLarge`.

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
`src/auth.ts` re-exports these helpers and supplies `signToken`, `verifyToken`, `requireAuth`, and `requireAdmin`.
Protected routes use `requireAuth` before they read `req.user`. Admin routes also use `requireAdmin`.

`src/app.ts` exports the application without opening a port.
`src/server.ts` starts the HTTP listener.
