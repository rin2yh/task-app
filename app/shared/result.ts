export type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; error: E };

export const Result = {
  /**
   * try/catch/finally を Result 型に包む薄いラッパー。
   * `onFinally` は例外時/正常終了時の双方で必ず呼ばれ、戻りが Promise の場合は await する。
   * `onFinally` 自身が throw した場合は素の `try/finally` 同様にその例外が伝播する。
   */
  async try<T>(
    fn: () => Promise<T> | T,
    onFinally?: () => void | Promise<void>,
  ): Promise<Result<T>> {
    try {
      return { ok: true, value: await fn() };
    } catch (error) {
      return { ok: false, error };
    } finally {
      if (onFinally) await onFinally();
    }
  },
};
