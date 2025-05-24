import { SemaphoreQueue } from "../queue/mod.ts";
import { sleep } from "jsr:@nodef/extra-sleep";

const queue = new SemaphoreQueue(5);

for(let i = 0; i < 10; i++) {
    queue.run(async () => {
        console.log(i);
        await sleep(1000 * 5);
        return String(i)
    });
}