import {Task, ActionId} from './Task'
import { TaskQuery } from './TaskQuery'
import {cellDecorator as cell} from '../cellDecorator'

export class Queue {
    static actionIds: ActionId[] = []

    @cell protected status: Promise<void> | Error | void

    protected tasks: Task[] | void = []

    constructor(
        public readonly displayName: string,
        protected parallel: boolean = true
    ) {}

    toString() { return this.displayName }

    find(actionId?: ActionId | ActionId[] | void, throwPromise?: boolean): TaskQuery {
        const query = new TaskQuery(actionId, throwPromise)
        this.status
        if (this.tasks) query.add(this.tasks)
        return query
    }

    run(handler: () => void, ids?: ActionId | ActionId[] | void): void {
        if (!this.tasks) return
        let actionId: ActionId | void
        let actionGroup: ActionId | void
        if (ids instanceof Array) {
            actionId = ids[0]
            actionGroup = ids[1]
        } else {
            actionId = ids
        }

        const {actionIds} = Queue
        if (!actionGroup && actionIds.length > 0)
            actionGroup = actionIds[actionIds.length - 1]
        if (!actionId && actionIds.length > 0)
            actionId = actionIds[actionIds.length - 2] || actionGroup

        if (!actionId) throw Error(
            `${this.displayName}.run(${handler.name}): no any actionId provided: wrap in action decorator or provide second argument`
        )

        const task = new Task(
            actionId,
            actionGroup,
            this,
            handler,
        )
        this.tasks.push(task)
        this.pull()
    }

    pull() {
        const {tasks, parallel} = this
        if (!tasks) return
        let status: Error | Promise<void> | void = null
        let oldStatus = this.status
        for (let task of tasks) {
            const value = task.value()
            if (value && oldStatus !== value) status = value
            if (!parallel) break
        }
        this.status = status
    }

    remove(task: Task) {
        if (!this.tasks) return
        this.tasks = this.tasks.filter(t => t !== task)
        this.pull()
    }

    destructor() {
        const {tasks} = this
        if (!tasks) return
        this.tasks = undefined
        for (let task of tasks) task.destructor()
    }
}
