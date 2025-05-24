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

    private async tryNext(): Promise<void> {
        if(this.queue.length === 0) {
            while(this.waiters.length > 0) {
                this.waiters.shift()?.();
            }
            return;
        }
        if(this.numRunning >= this.maxConcurrent) return;
        const [func, resolve, reject] = this.queue.shift()!;
        this.numRunning++;
        try {
            const res = await func();
            resolve(res);
        } catch(err) {
            reject(err);
        } finally {
            this.numRunning--;
            await this.tryNext();
        }
    }

    public run<V>(func : QueueCaller<V>): Promise<V> {
        return new Promise<V>((resolve, reject) => {
            this.queue.push([func, resolve as Resolver<unknown>, reject]);
            this.tryNext();
        })
    }

    public wait(): Promise<void> {
        return new Promise<void>((resolve) => this.waiters.push(resolve))
    }
}