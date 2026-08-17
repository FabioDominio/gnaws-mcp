# Contributing to @gnaws/mcp

Thank you for your interest in contributing!

## Branches

- `main` — stable, tagged releases only. Never push directly.
- `dev` — integration branch. Target this branch for all PRs.
- Feature branches — create from `dev`, name them `feat/your-thing` or `fix/your-thing`.

```
your-branch  →  PR  →  dev  →  (release PR)  →  main
```

Hotfixes for critical bugs branch from `main` directly:

```
hotfix/critical-bug  →  PR  →  main  (tagged immediately)
                     →  also merged into dev to stay in sync
```

## Workflow

1. Fork the repo
2. Create a branch from `dev`:
   ```bash
   git checkout dev
   git checkout -b feat/your-feature
   ```
3. Make your changes — commit style is your choice, we'll clean up at merge time
4. Open a PR targeting `dev`
5. Describe **what** you changed and **why**

We squash small PRs and use merge commits for larger features with meaningful history.
No need to rebase or squash before opening a PR.

## Commit messages (for your own commits)

We use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add progress notifications to scan tool
fix: handle missing region in profile gracefully
docs: improve tool descriptions
chore: bump dependencies
```

## Development setup

```bash
git clone git@github.com:FabioDominio/gnaws-mcp.git
cd gnaws-mcp
npm install

npm run dev    # run with tsx (requires .env with AWS_PROFILE)
npm run build  # compile with swc
npm run lint   # lint with eslint
npm run typecheck  # type-check without emitting
```

### Environment variables

Create a `.env` file:

```env
AWS_PROFILE=your-profile
LOG_LEVEL=debug
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx @gnaws/mcp
```

### Dependencies

This package depends on `@gnaws/core`. During development, if you need to work on the core library simultaneously, you can use `npm link`:

```bash
cd ../gnaws-core
npm link
cd ../gnaws-mcp
npm link @gnaws/core
```

## Adding a tool

1. Add the tool definition in `src/app.ts` (name, description, input schema with Zod)
2. Implement the handler logic
3. Return structured content with actionable next-step guidance
4. All logging must go to stderr (use the logger from `src/logger.ts`)

## Code style

- TypeScript strict mode
- ESLint enforced — run `npm run lint` before pushing
- No `any` without a comment explaining why
- All logging to stderr (never stdout — it's reserved for MCP stdio transport)

## License

By contributing you agree your code is licensed under AGPL-3.0.
