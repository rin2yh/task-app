---
description: E2E (Playwright) テストおよびそこから操作されるプロダクトコードに対する方針
globs:
  - "app/tests/e2e/**/*.{ts,tsx}"
  - "app/playwright.config.ts"
---

# E2E (Playwright) ルール

`app/tests/e2e/**` の Playwright テスト、およびそこから操作される `app/client/**` / `app/pages/**` のプロダクトコードに対する方針。新しい E2E 関連ルールが必要になったらこのファイルにセクションを追加する。

## 1. ロケーターは意味的に書く（`data-testid` を使わない）

### NG

- React コンポーネント / ページに E2E のための `data-testid` 属性を**追加しない**。
- Playwright で `getByTestId` を**使わない**。
- 既存の `data-testid` を見つけたら削除し、テストを意味的ロケーターに書き換える。

### 優先順位

要素取得は次の順で検討する。

1. **role + accessible name** — `getByRole('button', { name: '保存' })`, `getByRole('heading', { name: 'Todo' })`
2. **ラベル / プレースホルダー** — `getByLabel('タイトル')`, `getByPlaceholder('プロジェクト名')`
3. **表示テキスト** — `getByText('My Task')`
4. **landmark role** — `getByRole('banner')`（`<header>`）, `getByRole('navigation')` 等
5. **やむを得ない場合のみ** `aria-label` / `aria-labelledby` をプロダクトコードに追加してアクセシビリティと両立させる

### 理由

- `data-testid` はテスト専用の漏れた抽象化で、プロダクトコードを汚染し JSX を肥大化させる。
- 意味的ロケーターは「ユーザーがどう要素を識別するか」と一致するため、a11y 改善と E2E 保守性が同時に上がる。
- 意味的に取得できないなら、しばしばプロダクト側のアクセシビリティ不足のサイン。

### 例外

明確な理由（DnD の内部識別子、外部ライブラリの制約等）がある場合は、`data-testid` ではなく意味的な `data-*` 属性または `aria-*` 属性を使う。新規追加時はレビューで合意を取る。

### 例

```tsx
// NG
<span data-testid="auth-login">{user.login}</span>
await expect(page.getByTestId('auth-login')).toContainText('alice');

// OK
{user.login}
await expect(page.getByRole('banner')).toContainText('alice');
```

```ts
// NG
await page.getByTestId('new-task-c1').click();

// OK — ダイアログの見出しと placeholder で取得
await page.getByRole('heading', { name: '新規タスク' }).waitFor();
await page.getByPlaceholder('タイトル').fill('My Task');
```
