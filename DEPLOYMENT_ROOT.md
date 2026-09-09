# Deployment root

The current Vesta Flow application is in `vesta-flow-v1.0.2/`.

In Vercel, set **Root Directory** to `vesta-flow-v1.0.2`. Leave **Output Directory** unset so Next.js controls the deployment output.

## Pre-deploy verification

From the live folder, run `npm ci`, `npm run verify`, and `npm run build`. Write operations must remain explicit, idempotent, and separately verified against Follow Up Boss.
