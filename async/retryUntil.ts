import { retry, type RetryOptions } from "@std/async/retry";

export function retryUntil<T>(
    fn: (() => Promise<T>) | (() => T),
    predicate: (result : T) => boolean,
    options?: RetryOptions
) : Promise<T> {
    return retry(async () => {
        const result = await fn();
        if(!predicate(result)) throw new Error("Predicate not met");
        return result;
    }, options);
}

if(import.meta.main) {
    let attempts = 0

    const result = await retryUntil(() => {
        attempts++
        console.log(attempts)
        return Math.random()
    }, x => x > 0.8, { maxAttempts: 10 })

    console.log(result, attempts)
}