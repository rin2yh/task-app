---
name: ui-screenshot
description: Capture mobile + desktop screenshots of a UI change with Playwright in this sandbox and post them to the active PR. Use when the user asks to "Playwrightでスクショ撮って", "UIのスクショ撮って", "スクショをPRに貼って", or proactively after editing `app/client/**` while a PR exists — レスポンシブ / モーダル / ボトムシート / focus ring 系の修正は実機なしで確認できないので必須。
---

# ui-screenshot

UI 変更の検証スクショを Playwright で撮って PR に貼る手順。Sandbox 内でも動くよう、プリインストール済みの playwright/chromium を直接使う。

## 1. ツールチェーン

- Global `playwright@1.56.1`: `/opt/node22/lib/node_modules/playwright`
- Chromium build 1194: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`

`app/` の devDep `@playwright/test@1.59.x` はビルド 1217 を要求するので**使わない** (sandbox はオフラインなので chromium 1217 は降ってこない)。`createRequire('/opt/node22/lib/node_modules/')` でグローバル `playwright` を読む。

## 2. dev server を起こす

```bash
cd app
pnpm install --frozen-lockfile     # node_modules がなければ
pnpm migrate                       # ローカル D1 を初期化
cp .dev.vars.example .dev.vars
# SESSION_SECRET は 32+ 文字必要
sed -i 's/^SESSION_SECRET=.*/SESSION_SECRET="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/' .dev.vars
NODE_ENV=test pnpm dev > /tmp/vite.log 2>&1 &
until grep -q "ready in" /tmp/vite.log; do sleep 1; done
```

`NODE_ENV=test` で `FakeGitHubOAuthClient` (`server/auth/oauth/fake-github-client.ts`) が選択され、`POST /auth/github` form `login=<name>` で認可画面ナシでログインできる (`tests/e2e/fixtures/session.ts` と同じ仕組み)。

## 3. 撮影スクリプト

`/tmp/shot.mjs` に以下を書いて `NODE_PATH=/opt/node22/lib/node_modules node /tmp/shot.mjs` で実行。`scenes` は変更した UI に合わせて毎回書き換える。

```js
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium, devices } = require('playwright');

const BASE = 'http://localhost:5173';
const OUT = '/tmp/shots';
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

async function snap(label, device, drive) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  const auth = await page.request.post(`${BASE}/auth/github`, { form: { login: `shot-${label}` } });
  if (!auth.ok()) throw new Error(`auth ${auth.status()}`);
  await page.goto(`${BASE}${new URL(auth.url(), BASE).pathname}`);
  await drive(page);
  await page.screenshot({ path: `${OUT}/${label}.png` });
  await ctx.close();
}

const drive = async (page) => {
  // 例: ボトムシートまで辿り着く操作。変更 UI に合わせて書き換える。
  await page.getByPlaceholder('プロジェクト名').fill('Demo');
  await page.getByRole('button', { name: '作成' }).click();
  await page.getByRole('link', { name: 'Demo' }).click();
  await page.getByRole('button', { name: /タスク追加/ }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(400); // animations
};

await snap('mobile', { ...devices['iPhone 13'] }, drive);
await snap('desktop', { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, drive);
await browser.close();
```

ロケータは `tests/e2e/pages/*.ts` を参考にする (`getByRole`, `getByPlaceholder` など意味的なものを使う。`data-testid` は禁止 — `.claude/rules/e2e.md` 参照)。

### モバイル特有: ソフトキーボードのシミュレート

ヘッドレス chromium には実キーボードがない。`--kb-inset` を JS で書き換えると `pb-[calc(... + var(--kb-inset))]` が発火する。

```js
await page.evaluate(() => {
  document.querySelector('[role="dialog"]')?.style.setProperty('--kb-inset', '336px');
});
await page.screenshot({ path: `${OUT}/mobile-keyboard.png` });
```

## 4. PR に貼る

スクショは **repo に push しない**。`gh release upload` で `screenshots` という単一の release にアセットとして上げ、その公開 URL を PR コメントから参照する。リリース 1 個ぶんの掲載枠 (Releases タブに一行) だけで済む。

### 4.1 専用 release を確保 (初回のみ)

```bash
gh release view screenshots --repo rin2yh/task-app >/dev/null 2>&1 \
  || gh release create screenshots \
       --title "UI screenshots" \
       --notes "Auto-uploaded by the ui-screenshot skill. Not a real release." \
       --repo rin2yh/task-app
```

### 4.2 アセットをアップロード

衝突しないようファイル名に `pr<N>-<short-sha>-<label>.png` を付ける。`--clobber` で同名を上書き。

```bash
PR=88
SHA=$(git rev-parse --short HEAD)
cd /tmp/shots
for f in *.png; do mv "$f" "pr$PR-$SHA-$f"; done
gh release upload screenshots pr$PR-$SHA-*.png --clobber --repo rin2yh/task-app
```

### 4.3 PR にコメント

`mcp__github__add_issue_comment` で release asset URL を埋め込む。public repo なら認証なしで `<img>` がレンダリングされる。

```
## UI screenshots — `<short-sha>`

| | mobile (390×844) | desktop (1280×800) |
| --- | --- | --- |
| no keyboard | ![](https://github.com/rin2yh/task-app/releases/download/screenshots/pr<N>-<sha>-mobile.png) | ![](https://github.com/rin2yh/task-app/releases/download/screenshots/pr<N>-<sha>-desktop.png) |
| with keyboard | ![](https://github.com/rin2yh/task-app/releases/download/screenshots/pr<N>-<sha>-mobile-keyboard.png) | — |
```

PR diff にも main の履歴にもスクショは入らない。要らなくなった古いアセットは `gh release delete-asset screenshots <name>` で個別に消せる。

## 5. 後片付け

```bash
pkill -f "vite --config" || true
rm -f app/.dev.vars                # placeholder secret なので残さない
rm -rf /tmp/shots /tmp/shot.mjs /tmp/shot-wt /tmp/vite.log
```

## やらないこと

- `pnpm test:e2e` / `@playwright/test` を流用しない (上記 §1 のビルド不一致)
- スクショを repo に commit / push しない (Releases にだけ上げる)
- private repo に対して上のフローを使わない (release asset の URL は private では認証必須でレンダリングされない)
- `data-testid` ベースのロケータを書かない (`.claude/rules/e2e.md` §3)
- `page.waitForTimeout` をロード待ちに使わない (アニメ完了の保険にだけ使う; `.claude/rules/e2e.md` §6)
