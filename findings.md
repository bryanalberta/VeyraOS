# Findings: Production Build Failure & Remediation Insights

## Next.js 16 App Router Constraint on `page.tsx`
1. **Disallowed Named Exports:**
   Next.js App Router enforces that every `page.tsx` file must only export the default component (`export default`) and recognized Next.js route configurations (`metadata`, `generateMetadata`, `revalidate`, `dynamic`, `generateStaticParams`, etc.).
   Any extra named export (components like `DashboardContent`, reducers like `posReducer`, formatters like `formatSaleDate`, constants like `EXPENSE_CATEGORIES`, utility functions like `getSafeRedirectUrl`) triggers `TS2344: Type 'OmitWithTag<...>' does not satisfy the constraint '{ [x: string]: never; }'`.
2. **`PageProps` Constraint:**
   - In Next.js App Router, the page component default export receives `{ params, searchParams }` from Next.js server runtime.
   - If the component has default parameter `= {}` or optional `props?: Props`, its inferred type becomes `Props | undefined`, which violates `T extends PageProps`.
   - Next.js 16 requires dynamic route params to be `Promise<SegmentParams>`. A union with synchronous `{ id: string }` fails type checking.
3. **Vitest Unit Test Dependency:**
   - Test files currently import named exports directly from `page.tsx` files (e.g. `import { posReducer } from "./page"`, `import { DashboardContent } from "./page"`).
   - If we simply delete the `export` keyword from `page.tsx`, tests will immediately fail to compile.
   - The correct pattern is to extract these components/helpers to dedicated files in the same directory (e.g., `src/app/dashboard/dashboard-content.tsx`, `src/app/demo/sales/new/pos-reducer.ts`) and update both `page.tsx` and the test files to import from the dedicated module.
