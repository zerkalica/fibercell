import { isPromise } from '../utils'
import { ActionId, Task } from './Task'

export class TaskQuery {
    protected tasks: Task[] = []
    protected actionIds: ActionId[] | void

    constructor(
        actionId?: ActionId[] | ActionId | void
    ) {
        this.actionIds = actionId instanceof Array
            ? actionId
            : (actionId ? [actionId] : undefined)
    }

    add(allTasks: Task[]): this {
        const {tasks, actionIds} = this
        if (!actionIds) {
            this.tasks = allTasks
            return this
        }

        for (let task of allTasks) {
            for (let id of actionIds) {
                if (task.actionId !== id && task.actionGroup !== id) continue
                tasks.push(task)
            }
        }

        return this
    }

    get pending(): boolean {
        for (let task of this.tasks) {
            const status = task.status()
            if (status instanceof Error) throw status
            if (isPromise(status)) return true
        }

        return false
    }

    get errors(): Error[] | void {
        let errors: Error[] | void
        for (let task of this.tasks) {
            const status = task.status()
            if (!(status instanceof Error)) continue
            if (!errors) errors = []
            errors.push(status)
        }

        return errors
    }

    abort() {
        for (let task of this.tasks) task.abort()
    }

    wait() {
        for (let task of this.tasks) task.wait()
    }

    merge(sibling: TaskQuery) {
        this.add(sibling.tasks)
    }
}
