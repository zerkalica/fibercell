import {ActionId} from './Task'
import { TaskQuery } from './TaskQuery'

export interface IQueue {
    find(actionId: ActionId | ActionId[] | TaskQuery): TaskQuery
    destructor(): void
}

export interface QueueController {
    remove(queue: IQueue): void
}

export class QueueRegistry implements QueueController {
    protected queues: IQueue[] = []

    find(actionId: ActionId | ActionId[]): TaskQuery {
        const tasks = new TaskQuery(actionId)
        for (let queue of this.queues) queue.find(tasks)

        return tasks
    }

    add(queue: IQueue) {
        this.queues.push(queue)
    }

    remove(queue: IQueue) {
        this.queues = this.queues.filter(q => q !== queue)
    }

    destructor() {
        for (let queue of this.queues) queue.destructor()
        this.queues = undefined
    }
}
