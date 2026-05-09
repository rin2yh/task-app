---
name: create-rule
description: Add a new project coding rule to `.claude/rules/<topic>.md`. Use when the user asks to "ルールを追加", "rules に書いて", "Claude rules を作成", codify a convention, ban a pattern, or extract a guideline that came up in conversation into a persistent rule file.
---

# create-rule

`.claude/rules/<topic>.md` に新しい (または既存の) プロジェクトルールを追加する。ルールは session 開始時に context に読み込まれ、以後の作業で Claude が遵守する。

## 手順

1. **既存の `.claude/rules/*.md` を必ず読む。** スタイル (言語、見出し階層、フロントマターのキー、文体、文量) を踏襲する。新規ルールを既存スタイルから乖離させない。
2. **トピックの粒度を決める。** 1 ファイル = 1 トピック (例: `ts.md`, `react.md`, `e2e.md`)。既存ファイルに収まるなら ## セクション追加で済ませる。
3. **filename は kebab-case。** 言語名・領域名を短く (`ts.md` であって `typescript-rules.md` ではない)。
4. **フロントマターを書く。** 下記「フロントマター」を参照。
5. **body を書く。** 下記「body の書き方」を参照。
6. **`/rules` のような meta コマンドを使わない。** ファイルは普通の Edit/Write で扱う。

## フロントマター

YAML フロントマターでルールの適用範囲 (path filter) を指定する。

```yaml
---
paths:
  - "**/*.{ts,tsx}"
---
```

**約束事:**

- `paths:` または `globs:` を使う。プロジェクトの既存ファイルと揃える (本プロジェクトは `react.md` が `paths:`、`e2e.md` が `globs:` の混在)。
- glob は**必ずダブルクォート**で囲む。`*` や `{` は YAML の予約文字で、unquoted は silent failure する ([参考: anthropics/claude-code#13905](https://github.com/anthropics/claude-code/issues/13905))。
- YAML list 形式 (ハイフン + クォート文字列) で書く。
- スコープは最小に。「全 TS で守るべき」なら `**/*.{ts,tsx}`、「特定ディレクトリのテスト」なら `app/tests/e2e/**/*.ts` など。
- `description:` も書ける (一行サマリ。`/skills` メニューで使われる)。

## body の書き方

- 言語: プロジェクトの既存 rules ファイルと揃える。本プロジェクトの既存は日本語。
- 構造:
  - `# <トピック> ルール` (h1 はタイトルのみ)
  - 1〜2 文の導入 (どんなときに従うかを言い切る)
  - `## <ルール名>` または `## N. <ルール名>` (既存ファイルの番号付け方針に合わせる)
  - 必要に応じて `### 理由` / `### 例外` / `### NG` / `### OK` の下位セクション
- コード例は ` ```ts ` / ` ```tsx ` フェンスで NG → OK の順に。
- 文量はルールの特異性に比例。`react.md` のように 1 ルール 5 行で十分なら冗長に書かない。

## 「やらない」リスト

- **依頼されていないルールを足さない。** ユーザが「`X` 禁止」と言ったら `X` だけ書く。「ついでに関連の `Y` も…」を勝手に追加しない。
- **`types.ts` のような型集約ファイルを skill 内で作らない。** 型は責務ファイルに置く (本プロジェクトの `ts.md` 参照)。
- **既存ファイルのリネーム・大規模書き換えを巻き込まない。** 新規ルール追加は最小差分で。
- **`description`/`paths` を guess しない。** 既存 rules を読んでから決める。
- **「以後 X しないでください」のような Claude メモリ的記述を rules に入れない。** rules は project の規約。一時的な指示は対象外。

## 参考: 本プロジェクトの既存 rules

- `.claude/rules/react.md` — `paths: ["**/*.{ts,tsx}"]`、メモ化禁止 1 ルール、簡潔
- `.claude/rules/e2e.md` — `globs: [...]` + `description:`、Playwright 公式 Best Practices を具体化、長め (10+ セクション)
- `.claude/rules/ts.md` — `paths: ["**/*.{ts,tsx}"]`、`types.ts` 禁止 1 ルール

## 参考: 公式ドキュメント

- [Memory: path-specific rules](https://code.claude.com/docs/en/memory) — `paths:` の仕様
- [Skills frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference) — skill 自体のフロントマター
