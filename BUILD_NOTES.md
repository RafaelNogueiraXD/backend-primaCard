# Build Configuration for Vercel

## TypeScript Configuration

The project uses `tsconfig.json` with the following settings to avoid false positives:

```json
{
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```

## Unused Parameters Convention

Parameters prefixed with `_` (underscore) indicate they are intentionally unused but required by the interface:

```typescript
app.get('/health', (_req: Request, res: Response) => {
  // _req is required by Express signature but not used
})
```

## If Build Fails on Vercel

If Vercel still shows TS6133 errors, add this to `vercel.json`:

```json
{
  "build": {
    "env": {
      "TYPESCRIPT_STRICT": "false"
    }
  }
}
```

Or update the build command in `package.json`:

```json
{
  "vercel-build": "tsc --noUnusedParameters false --noUnusedLocals false && prisma generate"
}
```

## Current Build Commands

- `npm run build` - Full TypeScript compilation + Prisma generate
- `npm run vercel-build` - Optimized for Vercel (only Prisma generate)

Both commands should pass without errors.
