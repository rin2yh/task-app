---
description: E2E (Playwright) テストの執筆・修正に関する方針。Playwright 公式 Best Practices に準拠
paths:
  - "app/tests/e2e/**/*.{ts,tsx}"
---

# E2E (Playwright) ルール

`app/tests/e2e/**` の Playwright テストを書く / 修正するときの方針。Playwright 公式 [Best Practices](https://playwright.dev/docs/best-practices) を本プロジェクト向けに具体化したもの。新しい方針が必要になったらこのファイルにセクションを追加する。

## 1. ユーザーから見える振る舞いをテストする

- 実装詳細（クラス名、内部状態、関数呼び出し回数）ではなく、**ユーザーが見て / 触って分かること**を検証する。
- アサーションは「画面に〇〇と表示されている」「ボタンが押せる」など、ユーザーの観点で書く。

## 2. テストは独立に保つ

- テスト間で状態を共有しない。Playwright は各テストで新しい `BrowserContext` を作るので**その仕組みに乗る**。
- グローバルな順序依存を作らない。並列実行で壊れる前提でデータを準備する。
- セットアップは `test.beforeEach` / fixture（`tests/e2e/fixtures/session.ts` の `authenticate` など）で完結させる。
- データを残すテストを書かない。必要なら `test.afterEach` でクリーンアップする。

## 3. ロケーターは意味的に書く（`data-testid` を使わない）

Playwright 推奨のロケーター優先順位を**さらに厳しく**して、`data-testid` を**禁止**する。

### NG

- React コンポーネント / ページに E2E のための `data-testid` 属性を**追加しない**。
- Playwright で `getByTestId` / `page.locator('[data-testid=...]')` を**使わない**。
- 既存の `data-testid` を見つけたら削除し、テストを意味的ロケーターに書き換える。
- CSS / XPath セレクター（`page.locator('.btn-primary')`, `page.locator('//div[1]')`）は使わない。DOM 構造変更に弱い。

### 優先順位

1. **role + accessible name** — `page.getByRole('button', { name: '保存' })`, `page.getByRole('heading', { name: 'Todo' })`
2. **ラベル / プレースホルダー** — `page.getByLabel('タイトル')`, `page.getByPlaceholder('プロジェクト名')`
3. **表示テキスト** — `page.getByText('My Task')`
4. **landmark role** — `page.getByRole('banner')`（`<header>`）, `page.getByRole('navigation')` 等
5. **やむを得ない場合のみ** `aria-label` / `aria-labelledby` をプロダクトコードに追加してアクセシビリティと両立させる

### 理由

- `data-testid` はテスト専用の漏れた抽象化で、プロダクトコードを汚染し JSX を肥大化させる。
- 意味的ロケーターは「ユーザーがどう要素を識別するか」と一致するため、a11y 改善と E2E 保守性が同時に上がる。
- 意味的に取得できないなら、しばしばプロダクト側のアクセシビリティ不足のサイン。

### 例外

DnD の内部識別子、外部ライブラリの制約等で意味的に表現できない場合は、`data-testid` ではなく意味的な `data-*`（例: `data-column-id`）または `aria-*` 属性を使う。新規追加時はレビューで合意を取る。

## 4. ロケーターはチェーンとフィルターで絞る

複数候補がある場合は階層と属性で絞り込む。広いロケーターに `.filter()` / `.locator()` をチェーンする。

```ts
// 重複しがちなボタンを、所属する行で絞り込む
const row = page.getByRole('listitem').filter({ hasText: 'Demo Project' });
await row.getByRole('button', { name: '削除' }).click();

// dialog 内の入力に限定する
const dialog = page.getByRole('dialog', { name: '新規タスク' });
await dialog.getByPlaceholder('タイトル').fill('My Task');
```

## 5. Web-first アサーションを使う

- `await expect(locator).toBeVisible()` のように **`expect()` を await する**。Playwright の自動リトライ機構が効く。
- `expect(await locator.isVisible()).toBe(true)` のような「同期スナップショット → 比較」は**禁止**。レースコンディションの原因。
- `toHaveText`, `toHaveURL`, `toContainText`, `toBeEnabled`, `toHaveCount` などを使う。

```ts
// NG: 同期スナップショット
expect(await page.getByText('welcome').isVisible()).toBe(true);

// OK: web-first
await expect(page.getByText('welcome')).toBeVisible();
```

## 6. ハード待機を使わない

- `page.waitForTimeout(ms)` を**使わない**。テストを遅くし、かつ不安定にする。
- ロケーターの actionability チェックと web-first アサーションの auto-waiting に任せる。
- どうしても明示的に待つ場合は条件ベース（`page.waitForURL`, `locator.waitFor({ state: ... })`, `page.waitForResponse`）を使う。

## 7. サードパーティに依存しない

- 外部 API（GitHub OAuth、決済等）への実呼び出しを E2E に含めない。レート制限・ネットワーク不安定・コストでフレークする。
- 認可フローは `NODE_ENV === 'test'` 時に `factory.ts` が返すフェイク OAuth クライアント（`server/auth/oauth/fake-github-client.ts`）に切り替える。`NODE_ENV` は Playwright 設定の `webServer.env` で注入済み。
- それ以外の外部依存は `page.route()` で**ネットワークをモック**する。

```ts
await page.route('https://api.example.com/**', (route) =>
  route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
);
```

## 8. テストを並列で安全に動かす

- Playwright 設定の `fullyParallel: true` を維持する。
- 外部状態（共有 DB の固定 ID 等）に依存しない。各テストは自分でリソースを作る。
- どうしても直列が必要な一連のシナリオは `test.describe.configure({ mode: 'serial' })` でローカルに直列化する（最小スコープに留める）。

## 9. デバッグは Trace Viewer / UI mode / codegen を使う

- フレーク調査は `pnpm test:e2e --trace on` でトレースを取り、`pnpm exec playwright show-trace` で確認する。
- ローカル開発では `pnpm test:e2e --ui`（UI mode）でステップ実行する。
- ロケーター発見は `pnpm exec playwright codegen http://localhost:5173` で当たりを付け、**そのまま貼らずに** 上記の優先順位に沿って書き直す。

## 10. CI 設定は Playwright 設定に集約する

- リトライ・ワーカー数・レポーター等は Playwright 設定で `process.env.CI` を見て切り替える（既存どおり）。
- 個別テスト内に `test.setTimeout` や `test.skip(true)` を散らさない。条件 skip は `test.skip(condition, '理由')` の形で理由付きで書く。

## 参考資料

- [Best Practices | Playwright](https://playwright.dev/docs/best-practices) — 全体の出典
- [Locators | Playwright](https://playwright.dev/docs/locators) — セクション 3, 4
- [LocatorAssertions | Playwright](https://playwright.dev/docs/api/class-locatorassertions) — セクション 5（web-first assertions）
- [Auto-waiting | Playwright](https://playwright.dev/docs/actionability) — セクション 6（ハード待機禁止の根拠）
- [Network | Playwright](https://playwright.dev/docs/network) — セクション 7（`page.route` によるモック）
- [Browser contexts | Playwright](https://playwright.dev/docs/browser-contexts) — セクション 2（テスト分離）
- [Parallelism | Playwright](https://playwright.dev/docs/test-parallel) — セクション 8
- [Trace Viewer / UI Mode / Codegen | Playwright](https://playwright.dev/docs/trace-viewer) — セクション 9
