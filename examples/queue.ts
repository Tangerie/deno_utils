import { SemaphoreQueue, SingularAsync } from "../queue/mod.ts";
import { sleep } from "jsr:@nodef/extra-sleep";

const queue = new SemaphoreQueue(5);

for(let i = 0; i < 10; i++) {
    queue.run(async () => {
        console.log(i);
        await sleep(1000);
        return String(i)
    });
}

await queue.wait();

const singular = new SingularAsync<number>();
singular.run(async () => {
    const m = Math.random();
    console.log(m);
    await sleep(1000);
    return m;
});
console.log(await singular.run(async () => await 0));