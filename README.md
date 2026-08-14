# Pokemon Racing League

## Local setup

Install the JavaScript dependencies and the pinned PocketBase server:

```sh
npm install
npm run pb:install
cp .env.example .env
```

Set `PB_USER` and `PB_PASS` in `.env` to create the local service/login user. Set
`PB_SUPERUSER_EMAIL` and `PB_SUPERUSER_PASS` to create a dashboard account; these are optional for
the app but required by `npm run pb:check` to inspect the collection schema.

Start PocketBase in one terminal. The tracked migrations automatically create all application
collections on first launch:

```sh
npm run pb
```

PocketBase runs at `http://127.0.0.1:8090`; its dashboard is at
`http://127.0.0.1:8090/_/`.

With PocketBase running, verify the migrated schema and relations with:

```sh
npm run pb:check
```

Start SvelteKit in another terminal:

```sh
npm run dev
```

## Administrative console

The command console is available only to the fixed service account or a user whose `isAdmin` field
has been enabled by a PocketBase superuser. Set that field from the PocketBase dashboard; normal
users cannot grant themselves administrative access through the API. Press the backtick key to open
the console. The destructive command requires the full `/deleteallraces --confirm` form.

## Building

```sh
npm run check
npm run build
```
