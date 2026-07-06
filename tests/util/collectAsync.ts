export async function fromAsync<T>(
  generator: () => AsyncGenerator<T>
): Promise<T[]> {
  const out: T[] = [];
  for await (const val of generator()) {
    out.push(val);
  }
  return out;
}
