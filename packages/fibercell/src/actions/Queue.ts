import {Task, ActionId} from './Task'
import {cellDecorator} from '../cellDecorator'
import { TaskQuery } from './TaskQuery'
import { QueueRegistry, IQueue, QueueController } from './QueueRegistry'
import { cellKeyDecorator } from '../cellKeyDecorator'

export class Queue implements IQueue {
    protected static registry = new QueueRegistry()

    static find(actionId: ActionId | ActionId[]): TaskQuery {
        return Queue.registry.find(actionId)
    }

    @cellKeyDecorator static get(name: string): Queue {
        const queue = new Queue(name, Queue.registry)
        Queue.registry.add(queue)
        return queue
    }

    static actionIds: ActionId[] = []

    @cellDecorator protected tasks: Task[] = []

    constructor(
        public readonly displayName: string,
        protected controller?: QueueController | void,
    ) {}

    toString() { return this.displayName }

    find(actionId?: ActionId | ActionId[] | TaskQuery | void): TaskQuery {
        const query = actionId instanceof TaskQuery
            ? actionId
            : new TaskQuery(actionId)

        return query.add(this.tasks)
    }

    run(handler: () => void, ids: ActionId | ActionId[] = Queue.actionIds): void {
        let actionId: ActionId 
        let actionGroup: ActionId
        if (ids instanceof Array) {
            actionId = ids[0]
            actionGroup = ids[1] || (Queue.actionIds === ids ? undefined : Queue.actionIds[0])
        }

        if (!actionId && !actionGroup) throw Error(
            `${this.displayName}.run(${handler.name}): no any actionId provided: wrap in action decorator or provide second argument`
        )

        const task = new Task(
            actionId,
            actionGroup,
            this,
            handler,
        )
        this.tasks = [...this.tasks, task]
        this.pull()
    }

    pull() {
        for (let task of this.tasks) task.status()
    }

    remove(task: Task) {
        this.tasks = this.tasks.filter(t => t !== task)
        this.pull()
    }

    destructor() {
        if (!this.tasks) return
        for (let task of this.tasks) task.destructor()
        if (this.controller) this.controller.remove(this)
        this.controller = undefined
        this.tasks = undefined
    }
}
