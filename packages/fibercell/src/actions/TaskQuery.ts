import { isPromise } from '../utils'
import { ActionId, Task } from './Task'

export class TaskQuery {
    protected tasks: Task[] | void = undefined
    protected actionIds: ActionId[] | void

    constructor(
        protected displayName: string,
        actionId?: ActionId[] | ActionId | void,
        protected throwPromise: boolean = true
    ) {
        this.actionIds = actionId instanceof Array
            ? actionId
            : (actionId ? [actionId] : undefined)
    }

    toString() { return this.displayName }

    add(raw: Task[] | TaskQuery): this {
        const {actionIds} = this
        const allTasks = raw instanceof TaskQuery ? raw.tasks : raw
        if (!allTasks) return this
        if (!actionIds) {
            this.tasks = allTasks
            return this
        }

        if (!this.tasks) this.tasks = []
        const tasks: Task[] = this.tasks

        for (let task of allTasks) {
            for (let id of actionIds) {
                if (task.actionId !== id && task.actionGroup !== id) continue
                tasks.push(task)
            }
        }

        return this
    }

    get pending(): boolean {
        if (!this.tasks) return false
        const results: Promise<any>[] = []
        for (let task of this.tasks) {
            const status = task.value()
            if (status instanceof Error) throw status
            if (isPromise(status)) {
                if (!this.throwPromise) return true
                results.push(status)
            }
        }

        if (results.length > 0) throw Promise.all(results).then(() => {})

        return false
    }

    get errors(): Error[] | void {
        if (!this.tasks) return
        let errors: Error[] | void
        for (let task of this.tasks) {
            const status = task.value()
            if (!(status instanceof Error)) continue
            if (!errors) errors = []
            errors.push(status)
        }

        return errors
    }

    has(search: Task | Task[]): boolean {
        if (!this.tasks) return false
        for (let task of this.tasks) {
            if (search instanceof Array) {
                if (search.includes(task)) return true
            } else if (search === task) return true
        }
        return false
    }

    abort() {
        if (!this.tasks) return
        for (let task of this.tasks) task.abort()
    }

    wait() {
        if (!this.tasks) return
        for (let task of this.tasks) task.wait()
    }
}
