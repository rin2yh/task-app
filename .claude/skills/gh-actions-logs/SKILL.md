---
name: gh-actions-logs
description: Inspect GitHub Actions workflow runs and step logs via the gh CLI. Use when the user asks to "Actions のログを見て", "CI のログ", "落ちた job を調べて", "deploy.yml の最新 run", or asks why a workflow / job / step failed.
---

# gh-actions-logs

`gh` CLI で GitHub Actions の run / job / step の状態とログを取りに行く手順。プロジェクト内では `--repo rin2yh/task-app` を必ず付ける (gh は workflow ファイルが checkout 済み repo にあると勘違いして空 run を返すことがある)。

## 1. 失敗 run を特定する

```bash
gh run list --workflow=<file>.yml --repo <owner>/<repo> --limit 10
```

- `<file>.yml` は `.github/workflows/` 配下のファイル名 (例: `deploy.yml`, `ci.yml`)。
- 出力カラム: `status`, `conclusion`, `title`, `workflow`, `branch`, `event`, `id`, `elapsed`, `started_at`。
- `failure` 行の **id** を控える。

`workflow` を絞らずに最新 run を見たいときは `--limit` だけ。

## 2. run の中で落ちた job を特定する

```bash
gh run view <run-id> --repo <owner>/<repo>
```

- 各 job の status と「✓ / X」が step 単位で出る。**X が付いた step 名** をそのままエラー再現コマンドとして使えることが多い。
- 末尾に `gh run view <run-id> --log-failed` のヒントが出るが**そのまま叩いても 403 で落ちる** (下記 §4)。

JSON でほしいときは:

```bash
gh run view <run-id> --repo <owner>/<repo> --json jobs
```

`jobs[].databaseId` が後述の `--job` の値、`jobs[].steps[].number` が step 番号、`jobs[].steps[].conclusion` が `failure` / `success` / `skipped`。

## 3. job 単位で見る

```bash
gh run view --job=<job-id> --repo <owner>/<repo>
```

step 一覧が job だけに絞られる。run に matrix が多くてノイズが多いときに便利。

## 4. ログ本文を取る (制限あり)

```bash
gh run view --log-failed --job=<job-id> --repo <owner>/<repo>
```

これが**この環境では 403 で落ちる**ことがある:

```
failed to get run log: HTTP 403: 403 Forbidden
(https://results-receiver.actions.githubusercontent.com/...)
```

理由: ログ本文は GitHub API が `results-receiver.actions.githubusercontent.com` への redirect を返すが、サンドボックスの allowlist にこのホストが入っていないため取れない。`gh api repos/.../actions/jobs/<id>/logs` も同様 (`Host not in allowlist`)。

### 代替策

1. **step の status と名前だけで原因特定する** — `gh run view <run-id>` で X が付いた step 名 (= 実行されたコマンド全文) と annotation (`Process completed with exit code N`) を見る。多くの CI 失敗 (lint/typecheck/test/wrangler 系) はこれで十分。
2. **ローカルで再現する** — step 名のコマンドをそのまま手元で叩く。env が必要なら job-level `env:` ブロックを `.github/workflows/<file>.yml` から書き写す。
3. **annotation を確認する** — `gh run view <run-id>` の最下部の `ANNOTATIONS` セクションは API 経由でも取れているので、コンパイラエラーや lint 違反は十分な情報が出ていることが多い。
4. **run summary を WebFetch する** — `https://github.com/<owner>/<repo>/actions/runs/<run-id>` を WebFetch で開けば公開リポジトリならステータス概要が見える (private repo は 404)。

## 5. 自分が出した PR の checks を見る

```bash
gh pr checks <pr-number> --repo <owner>/<repo>
```

`pending` / `pass` / `fail` と各 check の run URL が出る。失敗があれば run URL の末尾 `runs/<id>/job/<job-id>` から `<job-id>` を抜いて §3 に進む。

## 6. ノイズ回避のコツ

- `gh run watch <run-id>` は対話 UI が出てうまく動かないことがある。代わりに数十秒置いて `gh run view <run-id>` を再度叩く方が確実。
- workflow_dispatch でいまから走らせるなら `gh workflow run <file>.yml --repo <owner>/<repo> -f <input>=<value>` 後、`gh run list --workflow=<file>.yml --limit 1` で id を取る。
- matrix job は `gh run view <run-id>` だと job 名が `name ${{ matrix.x }}` のように展開済みで出るので grep でフィルタしやすい。

## 参考

- [`gh run` - GitHub CLI manual](https://cli.github.com/manual/gh_run)
- [GitHub Actions REST API - logs](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run) — 内部的に redirect されるため上記の 403 が出る理由
