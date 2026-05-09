---
name: gemini-review-loop
description: PR で Gemini Code Assist のレビューに対応し、`/gemini review` を PR コメントで投げ、新しいレビューが来たらまた直す、を Gemini が指摘を出さなくなるまで繰り返す。Use when the user asks to "gemini レビューループ", "gemini のレビューがなくなるまで直して", "/gemini review を投げて直し続けて", or wants Gemini Code Assist to keep reviewing until clean.
---

# gemini-review-loop

[Gemini Code Assist](https://developers.google.com/gemini-code-assist/docs/review-github-code) の PR レビューに対する**修正 → 再レビュー要求 → 修正** のループを、Gemini が新しい指摘を出さなくなるまで回す。

## 前提

- 対象 PR が `rin2yh/task-app` に存在し、Gemini Code Assist app がインストールされている。
- ユーザは「直近の Gemini レビューには既に対応済み (= push 済み)」の状態でこの skill を起動する想定。**最初の `/gemini review` 投稿は人間の review 対応より後**に行う。
- GitHub 操作は `mcp__github__*` ツール経由 (`gh` CLI は使わない)。

## 手順

### 1. 対象 PR を特定する

PR 番号が引数で来ていなければ、現在のブランチに紐づく PR を取る。

```
mcp__github__list_pull_requests({ owner: "rin2yh", repo: "task-app", state: "open", head: "rin2yh:<branch>" })
```

複数候補が出たら `AskUserQuestion` で確認する。**勝手に決めない。**

### 2. 直近の Gemini レビューに未対応のコメントがないか確認する

```
mcp__github__pull_request_read({ method: "get_pull_request_reviews", owner, repo, pullNumber })
mcp__github__pull_request_read({ method: "get_pull_request_review_comments", owner, repo, pullNumber })
```

- author が `gemini-code-assist[bot]` のレビューを抽出。
- 最新のレビューにぶら下がる review comments のうち `resolved: false` のものを列挙し、未対応があれば**先に修正してコミット & push** する。
- 既に全部対応済みなら次に進む。

### 3. `/gemini review` を PR コメントで投げる

```
mcp__github__add_issue_comment({ owner: "rin2yh", repo: "task-app", issueNumber: <pr>, body: "/gemini review" })
```

- body は `/gemini review` の **1 行のみ**。前置き文 ("お願いします" 等) を付けない (Gemini bot が command として認識しないことがある)。
- 投稿直後に PR の `updated_at` が動くので、後の polling 用に `now` を控える。

### 4. Gemini の新レビューを待つ

`mcp__github__subscribe_pr_activity({ owner, repo, pull_number })` で PR を subscribe し、**ターンを終了する**。

- `<github-webhook-activity>` イベントとして webhook が届いたら次のステップへ。
- **`Bash sleep` で polling しない。** webhook で起こされるのを待つ (CLAUDE Code の規約)。
- Gemini の review は通常 30s〜2min で来る。10 分以上来なければユーザに状況を報告して止める。

### 5. 届いたイベントを triage する

webhook で起きたら、まず author / event type を確認:

- `pull_request_review` で `user.login === "gemini-code-assist[bot]"` → 本命。step 6 へ。
- `issue_comment` で gemini bot からの自動応答 (`Hi @user, I'm starting a review...` 等) → 無視して待機継続 (step 4 に戻り subscribe を維持)。
- 他の reviewer / CI イベント → ループ対象外。**勝手に対応しない**。必要ならユーザに聞く。

### 6. レビュー内容を読み、終了判定する

```
mcp__github__pull_request_read({ method: "get_pull_request_reviews", ... })
```

最新の Gemini review について以下のいずれかなら**ループを抜ける**:

- `state === "APPROVED"`。
- review body が "Looks good to me" / "No issues found" / "LGTM" 系のみで、review comments が 0 件。
- 残った comment が **nit / nitpick / optional / consider** などの非ブロッキング表現だけ (Gemini は重大度を `severity: low` で出すことがある。`get_pull_request_review_comments` の body から判定)。
- **直前のループと同じ指摘**しか出ていない (= 収束しない兆候)。

抜けるときはユーザに「Gemini の指摘はもう無い (or 残りは nit のみ)」と1〜2 文で報告し、`mcp__github__unsubscribe_pr_activity` で subscribe を解除する。

### 7. ループ継続: 指摘に対応する

指摘が actionable なら:

1. comment ごとに「直す / 反論する」を判断。実装方針が複数ある時は `AskUserQuestion`。
2. コードを修正してコミット & push (ブランチは現在のブランチ)。
3. 直さない / 直せない comment には `mcp__github__add_reply_to_pull_request_comment` で**理由を返信**する (黙って閉じない)。
4. step 3 に戻って再度 `/gemini review` を投げる。

### 8. ループ上限

**最大 5 周**で打ち切る。それ以上回るなら収束していないので、ユーザに状況を報告して判断を仰ぐ。各周のコミット SHA と Gemini の主な指摘を 1 行ずつ記録しておくとレポートしやすい。

## やらないこと

- **`Bash sleep` での待機。** webhook subscribe で待つ。
- **`/gemini review` 以外のコマンドを混ぜる。** `/gemini summary` 等は別 skill。
- **gemini bot 以外のレビュアー (人間 / Copilot / 他 bot) のコメントへの自動対応。** 対象は Gemini Code Assist のみ。
- **Approve / Merge / Close。** ループを抜けた後の判断はユーザに渡す。
- **`--no-verify` での push / `git commit --amend`。** プロジェクト設定で deny されている。

## 参考

- [Gemini Code Assist for GitHub - commands](https://developers.google.com/gemini-code-assist/docs/review-github-code#use-gemini-code-assist) — `/gemini review`, `/gemini summary` の仕様
- [GitHub MCP - pull_request_read](https://github.com/github/github-mcp-server) — review / comment 取得 method 一覧
- 本リポジトリ `.claude/skills/gh-actions-logs/SKILL.md` — MCP / gh の使い分け方針
