import { tqdm, type TqdmOptions } from "../tqdm/tqdm.ts";
import { SemaphoreQueue } from "./semaphore.ts";
import type { QueueCaller } from "./types.ts";

export type ParallelTqdmOptions = Omit<TqdmOptions, "size"> & {
    /** An existing queue to share, or a max concurrency to create one. Default: 5 */
    queue?: SemaphoreQueue | number;
};

/**
 * Yields results in *completion* order as each settles, so the bar
 * reflects actual progress. If any task rejects, iteration throws
 * after in-flight tasks are accounted for.
 */
async function* asCompleted<T>(promises: Array<Promise<T>>): AsyncIterableIterator<T> {
    // Wrap each promise so we can race them all and remove the winner each round.
    const pending = new Map<number, Promise<[number, T]>>();
    promises.forEach((p, idx) => {
        pending.set(idx, p.then(value => [idx, value]));
    });

    let firstError: { err: unknown } | undefined;

    while (pending.size > 0) {
        try {
            const [idx, value] = await Promise.race(pending.values());
            pending.delete(idx);
            yield value;
        } catch (err) {
            // Find and remove the rejected promise(s) so we don't race them again,
            // but keep draining the rest before surfacing the error.
            firstError ??= { err };
            const settled = await Promise.allSettled(pending.values());
            pending.clear();
            for (const s of settled) {
                if (s.status === "fulfilled") yield s.value[1];
            }
        }
    }

    if (firstError) throw firstError.err;
}

export type TqdmRun<T> = AsyncIterableIterator<T> & PromiseLike<T[]>;

function awaitable<T>(iter: AsyncIterableIterator<T>): TqdmRun<T> {
    let collected: Promise<T[]> | undefined;
    return Object.assign(iter, {
        then<R1 = T[], R2 = never>(
            onfulfilled?: ((value: T[]) => R1 | PromiseLike<R1>) | null,
            onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
        ): PromiseLike<R1 | R2> {
            collected ??= Array.fromAsync(iter);
            return collected.then(onfulfilled, onrejected);
        },
    });
}

/**
 * Runs `tasks` through a SemaphoreQueue with a tqdm progress bar.
 * ```
 * for await (const result of ptqdm(urls.map(u => () => fetchThing(u)), { queue: 5, label: "fetch" })) {
 *     ...
 * }
 * ```
 * Or collect everything: `const results = await Array.fromAsync(ptqdm(tasks));`
 * Note: results arrive in completion order, not input order.
 */
export function ptqdm<T>(
    tasks: Array<QueueCaller<T>>,
    { queue = 5, ...opts }: ParallelTqdmOptions = {},
): TqdmRun<T> {
    const q = typeof queue === "number" ? new SemaphoreQueue(queue) : queue;
    const promises = tasks.map(task => q.run(task));
    return awaitable(tqdm(asCompleted(promises), { size: tasks.length, ...opts }));
}