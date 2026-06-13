import { ptqdm, type QueueCaller } from "@tangerie/utils/queue";
import { sleep } from "../internal/sleep.ts";
import { trange } from "@tangerie/utils/tqdm";

const tasks : QueueCaller<void>[] = [];

for(let i = 0; i < 100; i++) {
    tasks.push( () =>  sleep(100));
}

await ptqdm(tasks, { queue: 5, label: "Parallel" })

for await(const i of trange(0, 10, { label: "Parent" })) {
    await ptqdm(tasks, { queue: 5, label: `Child ${i}`, leave: false })
}