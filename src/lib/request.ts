/** Bound UI waits even when authentication or a network request never settles. */
export async function withTimeout<T>(request: PromiseLike<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("السيرفر مش بيرد. اتأكد من النت وجرب تاني.")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
