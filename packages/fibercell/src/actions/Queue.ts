import {Task, TaskKey} from './Task'
import {cellDecorator} from '../cellDecorator'

export class QueueStatus {
    size: number = 0
    error: Error | void = undefined
    errors: Error[] | void = undefined

    get pending(): boolean {
        return this.size > 0
    }
}

export enum QueueType {
    PARALLEL = 'PARALLEL',
    SINGLE = 'SINGLE',
    SERIAL = 'SERIAL',
}

export type ActionMethod = (...args: any[]) => void

export class Queue {
    protected tasks: Task[] | void = undefined

    constructor(
        public readonly displayName: string,
        public readonly type: QueueType = QueueType.SERIAL,
        protected readonly parentQueue?: Queue | void,
    ) {
        if (parentQueue) parentQueue.addSlave(this)
    }

    protected slaves: Queue[] | void = undefined

    addSlave(slave: Queue) {
        if (!this.slaves) this.slaves = []
        this.slaves.push(slave)
        this.changed()
    }

    removeSlave(slave: Queue) {
        if (this.slaves) {
            this.slaves = this.slaves.filter(s => s !== slave)
            if (this.slaves.length === 0) this.slaves = undefined
        }
        this.changed()
    }

    // create<Method extends ActionMethod>(method: Method, t: Object = null): Method {
    //     return ((...args: any[]) => {
    //         const binded = method.bind(t, ...args)
    //         setFunctionName(binded, method.name)
    //         this.run(binded)
    //     }) as Method
    // }
    protected taskMap: Map<TaskKey, Task> = new Map()

    run(key: TaskKey, handler: () => void): Task {
        if (!this.tasks) this.tasks = []
        const tasks = this.tasks
        if (tasks.length > 0 && this.type === QueueType.SINGLE) {
            const lastTask = tasks.pop()
            lastTask.destructor()
        }
        const task = new Task(
            `${this.displayName}.run(${handler.name})`,
            this,
            handler,
            key,
            this.taskMap
        )
        this.taskMap.set(key, task)
        tasks.push(task)
        this.changed()

        return task
    }

    locked(key: TaskKey): boolean {
        this.status // refresh tasks or load status from cache
        const task = this.taskMap.get(key)
        return task ? task.locked() : false
    }

    protected changed() {
        cellDecorator.retry(this.status)
        this.status
    }

    @cellDecorator get status(): QueueStatus {
        const tasks = this.tasks
        const status = new QueueStatus()
        const {slaves, type} = this
        if (tasks) {
            let hasCompleted = false
            for (let task of tasks) {
                const error = task.run()
                if (error instanceof Error) {
                    if (!status.error) status.error = error
                    if (!status.errors) status.errors = []
                    status.errors.push(error)
                } if (error) {
                    status.size++
                } else {
                    hasCompleted = true
                }

                if (type !== QueueType.PARALLEL) break
            }
            if (hasCompleted) {
                this.tasks = tasks.filter(task => !task.completed)
            }
        }

        if (slaves) {
            for (let slave of slaves) {
                status.size += slave.status.size
                if (slave.status.error && !status.error) status.error = slave.status.error
                if (slave.status.errors) {
                    status.errors = [...status.errors || [], ...slave.status.errors]
                }
            }
        }

        return status
    }

    get size(): number {
        return this.tasks ? this.tasks.length : 0
    }

    get pending(): boolean {
        return this.status.pending
    }

    get error(): Error | void {
        return this.status.error
    }

    retry(task?: Task) {
        if (task) {
            task.reset()
        } else if (this.tasks) {
            for (let current of this.tasks) current.reset()
        }
        this.changed()
    }

    abort(task?: Task) {
        if (!this.tasks) return
        if (task) {
            this.tasks = this.tasks.filter(t => t !== task)
            task.destructor()
        } else {
            for (let current of this.tasks) current.destructor()
            this.tasks = []
        }
        this.changed()
    }

    destructor() {
        const {slaves, tasks} = this
        if (this.parentQueue)
           this.parentQueue.removeSlave(this)
        if (slaves) for (let slave of slaves) slave.destructor()
        if (tasks) for (let task of tasks) task.destructor()
        this.slaves = undefined
        this.tasks = undefined
    }
}
