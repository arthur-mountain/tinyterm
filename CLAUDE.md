# TinyTerm — Project Guidelines

## Testing Strategy

**TDD applies to pure logic only.** ALWAYS write the test first, then implement.

Pure logic = stateless functions, data transformations, parsers, format converters.
I/O boundaries (network, canvas, OS processes) and third-party library wrappers are verified manually.

ALWAYS place tests alongside source: `packages/*/src/__tests__/`.

### Type checking counts as a test gate

ALWAYS run `pnpm -r typecheck` before marking any spec complete.

## Spec Workflow

Each spec follows this order:

1. Read the spec's acceptance criteria
2. Write unit tests for any pure logic introduced
3. Implement until tests pass (`pnpm -r typecheck` + Vitest green)
4. Manual browser verification against acceptance criteria
5. Commit
