import type { QueueCaller, Reject, Resolver } from "./types.ts";

export class SingularAsync<T> {
    private resolvers: Array<[Resolver<T>, Reject]> = [];
    private active : boolean = false;

    public run(func: QueueCaller<T>): Promise<T> {
        if (this.active) {
            return new Promise<T>((resolve, reject) => {
                this.resolvers.push([resolve, reject]);
            });
        } else {
            this.active = true;
            return new Promise((resolve, reject) => 
                func().then(result => {
                    this.resolvers.forEach(([resolver, _]) => resolver(result));
                    resolve(result);
                }).catch(err => {
                    this.resolvers.forEach(([_, rejecter]) => rejecter(err));
                    reject(err);
                }).finally(() => {
                    this.active = false;
                    this.resolvers = [];
                })
            )
        }
    }
}