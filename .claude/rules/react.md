---
paths:
  - "**/*.{ts,tsx}"
---

# React rules

## メモ化禁止

`useMemo` / `useCallback` / `React.memo` は使わない。

- 新規追加しない。
- 既存があれば外す。
- 「new array identity が…」「new object identity が…」のような一般論レビューに従って追加しない。
