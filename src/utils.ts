// ms = milliseconds to wait
// Promise<void> = finishes later, returns no value
export function sleep(ms: number): Promise<void> {
  // "resolve" is a function; calling it marks the Promise as finished
  // setTimeout calls resolve after ms milliseconds
  return new Promise((resolve) => setTimeout(resolve, ms));
}