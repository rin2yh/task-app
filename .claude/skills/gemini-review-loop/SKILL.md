---
name: gemini-review-loop
description: PR で Gemini Code Assist のレビューに対応し、`/gemini review` を PR コメントで投げ、新しいレビューが来たらまた直す、を Gemini が指摘を出さなくなるまで繰り返す。Use when the user asks to "gemini レビューループ", "gemini のレビューがなくなるまで直して", "/gemini review を投げて直し続けて", or wants Gemini Code Assist to keep reviewing until clean.
---

# gemini-review-loop

[Gemini Code Assist](https://developers.google.com/gemini-code-assist/docs/review-github-code) の PR レビューに対する**修正 → 再レビュー要求 → 修正** のループを、Gemini が新しい指摘を出さなくなるまで回す。

## 前提

- 対象 PR が現在のリポジトリに存在し、Gemini Code Assist app がインストールされている。
- ユーザは「直近の Gemini レビューには既に対応済み (= push 済み)」の状態でこの skill を起動する想定。**最初の `/gemini review` 投稿は人間の review 対応より後**に行う。
- GitHub 操作は `mcp__github__*` ツール経由 (`gh` CLI は使わない)。

## 手順

### 1. 対象 PR を特定する

PR 番号が引数で来ていなければ、現在のブランチに紐づく PR を取る。

```
mcp__github__list_pull_requests({ owner: "<owner>", repo: "<repo>", state: "open", head: "<owner>:<branch>" })
```

複数候補が出たら `AskUserQuestion` で確認する。**勝手に決めない。**

### 2. 直近の Gemini レビューに未対応のコメントがないか確認する

```
mcp__github__pull_request_read({ method: "get_pull_request_reviews", owner, repo, pullNumber })
mcp__github__pull_request_read({ method: "get_pull_request_review_comments", owner, repo, pullNumber })
```

- author が `gemini-code-assist[bot]` のレビューを抽出。
- 返ってくる review thread の `is_resolved: false` のものを列挙し、未対応があれば**先に修正してコミット & push し、step 7 の手順 (`add_reply_to_pull_request_comment` で commit SHA 付きで返信) に従って各 comment に返信**する (`resolved` ではなく `is_resolved` なので注意)。
- 既に全部対応済みなら次に進む。

### 3. `/gemini review` を PR コメントで投げる

```
mcp__github__add_issue_comment({ owner, repo, issue_number: pullNumber, body: "/gemini review" })
```

- body は `/gemini review` の **1 行のみ**。前置き文 ("お願いします" 等) を付けない (Gemini bot が command として認識しないことがある)。
- 投稿直後に PR の `updated_at` が動くので、後のイベントがこの投稿より新しいことを確認するために、`add_issue_comment` のレスポンスに含まれる `created_at` を基準時刻として控える。

### 4. Gemini の新レビューを待つ

`mcp__github__subscribe_pr_activity({ owner, repo, pullNumber })` で PR を subscribe し、**ターンを終了する**。

- `<github-webhook-activity>` イベントとして webhook が届いたら次のステップへ。
- **`Bash sleep` で polling しない。** webhook で起こされるのを待つ (CLAUDE Code の規約)。
- Gemini の review は通常 30s〜2min で来る。10 分以上来なければ、`mcp__github__unsubscribe_pr_activity` で subscribe を解除してからユーザに状況を報告して止める。

### 5. 届いたイベントを triage する

webhook で起きたら、まずイベントの `created_at` が **step 3 で控えた基準時刻以降**であることを確認 (基準時刻より古いものは前ラウンドの遅延配信なので無視)。次に author / event type を確認:

- `pull_request_review` で `user.login === "gemini-code-assist[bot]"` → 本命。step 6 へ。
- `issue_comment` で gemini bot からの自動応答 (`Hi @user, I'm starting a review...` 等) → 無視して待機継続 (step 4 に戻り subscribe を維持)。
- 他の reviewer / CI イベント → ループ対象外。**勝手に対応しない**。必要ならユーザに聞く。

### 6. レビュー内容を読み、終了判定する

```
mcp__github__pull_request_read({ method: "get_pull_request_reviews", owner, repo, pullNumber })
mcp__github__pull_request_read({ method: "get_pull_request_review_comments", owner, repo, pullNumber })
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
2. コードを修正してコミット & push (ブランチは現在のブランチ)。**push 後に `git rev-parse HEAD` で commit SHA を控える** (次のステップで使う)。
3. **対応した comment には必ず `mcp__github__add_reply_to_pull_request_comment` で返信する**。フォーマット:
   - 直した場合: 何を変えたかを 1〜2 文 + commit SHA (短縮 7 桁) を `Fixed in <sha>` の形で。例: `pullNumber に統一しました。Fixed in 0adef48`。
   - 直さない場合: 理由を 1〜2 文 (黙って閉じない)。
   1 つの commit で複数 comment に対応した場合は同じ SHA を各返信に貼る。
4. step 3 (`/gemini review` 投稿) に戻る。

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
