export type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; error: E };

export const Result = {
  /**
   * 受け取った Promise / 値を await し、成功なら `{ ok: true }`、reject なら `{ ok: false }` で返す。
   * 関数を呼び出した時点で発生した同期 throw はラップ前なので捕捉できない。
   * 後処理が必要な場合は呼び出し側で `await Result.try(...)` の後に書く。
   */
  async try<T>(value: Promise<T> | T): Promise<Result<T>> {
    try {
      return { ok: true, value: await value };
    } catch (error) {
      return { ok: false, error };
    }
  },
};
