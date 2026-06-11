import type { Resolver, Reject, QueueCaller } from "./types.ts";

type SemaphoreQueueItem = [QueueCaller<unknown>, Resolver<unknown>, Reject];

export class SemaphoreQueue {
    private maxConcurrent : number;
    private numRunning = 0;
    private queue : SemaphoreQueueItem[] = [];
    private waiters : Array<Resolver<void>> = [];

    constructor(maxConcurrent : number) {
        if(maxConcurrent < 1) throw new Error("maxConcurrent must be greater than 0")
        this.maxConcurrent = maxConcurrent;
    }

    private get isIdle(): boolean {
        return this.numRunning === 0 && this.queue.length === 0;
    }

    private drainWaiters(): void {
        while(this.waiters.length > 0) this.waiters.shift()?.();
    }

    private tryNext(): void {
        while(this.numRunning < this.maxConcurrent && this.queue.length > 0) {
            const [func, resolve, reject] = this.queue.shift()!;
            this.numRunning++;
            (async () => {
                try {
                    resolve(await func());
                } catch(err) {
                    reject(err);
                } finally {
                    this.numRunning--;
                    if(this.isIdle) this.drainWaiters();
                    else this.tryNext();
                }
            })();
        }
    }


    public run<V>(func : QueueCaller<V>): Promise<V> {
        return new Promise<V>((resolve, reject) => {
            this.queue.push([func, resolve as Resolver<unknown>, reject]);
            this.tryNext();
        })
    }

    public wait(): Promise<void> {
        if(this.isIdle) return Promise.resolve();
        return new Promise<void>((resolve) => this.waiters.push(resolve));
    }
}