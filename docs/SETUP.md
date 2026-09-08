# Setup and deployment

[Live demo](https://rupee-radar-kappa.vercel.app) · [Project README](../README.md)

## Local development

Install Node.js 22.13+ and run `npm ci`, then `npm run dev -- --port 3010` from the repository root. No environment variables are required for the demo.

To test the production build:

```sh
npm run build
npm start -- --port 3010
```

## Vercel

1. Import `AviralKhanna/rupee-radar`, or your own fork, into Vercel.
2. Use the repository root and the **Next.js** framework preset.
3. Use `npm ci` to install dependencies and `npm run build` to build.
4. Leave the output directory at the Next.js default.
5. Deploy. No brokerage secrets are needed for the demo.

The existing project is connected to GitHub; pushes to its production branch can deploy automatically. `.vercelignore` excludes legacy build output and environment files from CLI uploads.

## Account integration

The historical Groww route is disabled unless explicitly enabled. Its environment gates are `ENABLE_PRIVATE_GROWW` on the server and `NEXT_PUBLIC_ENABLE_GROWW` for the UI. Credentials use `GROWW_API_KEY` and `GROWW_API_SECRET`. These are for a separately secured private setup, not the public demo. This repository does not implement per-user authentication for that route.

## Contributing

Open an issue to describe a bug or feature. For code changes, create a branch and run `npm run lint` and `npm run build` before opening a pull request. Keep personal statements and credentials out of commits.
