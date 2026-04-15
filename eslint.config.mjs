import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Contentful payloads are dynamic by nature; allow pragmatic typing in CMS + route handlers.
  {
    files: [
      'app/api/contentful/**/*.ts',
      'app/api/upload/route.ts',
      'components/cms/**/*.{ts,tsx}',
      'components/dashboard/**/*.{ts,tsx}',
      'lib/contentful/**/*.{ts,tsx}',
      'lib/store/**/*.{ts,tsx}',
      'lib/stores/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Rendering errors won't be caught by try/catch; allow defensive fallback in viewer.
  {
    files: ['components/cms/RichTextViewer.tsx'],
    rules: {
      'react-hooks/error-boundaries': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Ignore nested tool build output.
    'tools/uploader-app/.next/**',
  ]),
]);

export default eslintConfig;
