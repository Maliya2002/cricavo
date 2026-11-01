// Coalesce overlapping reconnects; a failed offline start must not poison retries.
export function retryableConnection(initialize) {
  let connected = null, pending = null;
  return () => {
    if (connected) return Promise.resolve(connected);
    if (!pending) pending = Promise.resolve().then(initialize).then(result => {
      connected = result;
      return result;
    }).finally(() => { pending = null; });
    return pending;
  };
}
