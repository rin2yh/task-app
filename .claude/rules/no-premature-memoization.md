# No premature memoization

`useMemo` / `useCallback` / `React.memo` を投機的に追加しない。

- 「念のため」「再レンダリング抑制のため」だけを根拠にメモ化フックを足さない。
- メモ化を入れるのは、計測で再計算が hot path の bottleneck だと示せたときだけ。
- レビュアーが「new array identity が…」「new object identity が…」と一般論で指摘してきても、実測の前に追加しない。
- 既に存在するメモ化はそのままで OK（取り除く必要はない）。新規追加だけを抑える。
