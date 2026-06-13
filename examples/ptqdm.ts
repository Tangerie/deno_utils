import { ptqdm, type QueueCaller } from "@tangerie/utils/queue";
import { sleep } from "../internal/sleep.ts";

const tasks : QueueCaller<void>[] = [];

for(let i = 0; i < 100; i++) {
    tasks.push( () =>  sleep(1000));
}

await ptqdm(tasks, { queue: 5, label: "Parallel" })
