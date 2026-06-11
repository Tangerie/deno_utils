import type { QueueCaller, Reject, Resolver } from "./types.ts";

export class SingularAsync<T> {
    private resolvers: Array<[Resolver<T>, Reject]> = [];
    private active : boolean = false;

    public run(func: QueueCaller<T>): Promise<T> {
        if (this.active) {
            return new Promise<T>((resolve, reject) => {
                this.resolvers.push([resolve, reject]);
            });
        }

        this.active = true;

        let started: Promise<T>;
        try {
            started = func();
        } catch (err) {
            started = Promise.reject(err);
        }

        return new Promise<T>((resolve, reject) => {
            started.then(
                (result) => {
                    const waiters = this.settle();
                    for (const [res] of waiters) res(result);
                    resolve(result);
                },
                (err) => {
                    const waiters = this.settle();
                    for (const [, rej] of waiters) rej(err);
                    reject(err);
                }
            );
        });
    }

    // Snapshot waiters and reset state *before* broadcasting, so a run()
    // triggered by a notified waiter starts a fresh cycle instead of being
    // parked into an array that's about to be cleared.
    private settle(): Array<[Resolver<T>, Reject]> {
        const waiters = this.resolvers;
        this.resolvers = [];
        this.active = false;
        return waiters;
    }
}