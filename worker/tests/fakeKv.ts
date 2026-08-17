/** Minimal in-memory stand-in for the subset of KVNamespace this worker uses. */
export function createFakeKv(): KVNamespace {
  const store = new Map<string, string>()
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    async put(key: string, value: string, _opts?: { expirationTtl?: number }) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
  } as unknown as KVNamespace
}
