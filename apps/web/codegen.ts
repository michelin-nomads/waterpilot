// GraphQL operation types for the web app (ADR 0003). Run via `npm run contracts`.
//
// The schema is the backend's exported SDL; documents are the `.graphql` operations
// under src/graphql/operations. `documentMode: 'string'` emits TypedDocumentString
// values (plain strings + types), so no GraphQL runtime ships in the bundle.
import type { CodegenConfig } from '@graphql-codegen/cli';

const scalars = {
  ID: 'string',
  UtcDateTime: 'string',
  LocalDate: 'string',
  DecimalString: 'string',
  MinorUnits: 'string',
  JSON: 'unknown',
};

const shared = {
  enumsAsTypes: true,
  useTypeImports: true,
  strictScalars: true,
  skipTypename: true,
  scalars,
};

const config: CodegenConfig = {
  schema: '../../packages/contracts/schema.graphql',
  documents: ['src/graphql/operations/**/*.graphql'],
  ignoreNoDocuments: false,
  generates: {
    'src/graphql/generated/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false, gqlTagName: 'graphql' },
      config: {
        ...shared,
        documentMode: 'string',
        avoidOptionals: { field: true, inputValue: false, object: true },
      },
    },
    // Full schema types (type-only), e.g. the root `Mutation` used to keep the
    // invalidation map exhaustive.
    'src/graphql/generated/schema.ts': {
      plugins: ['typescript'],
      config: shared,
    },
  },
};

export default config;
