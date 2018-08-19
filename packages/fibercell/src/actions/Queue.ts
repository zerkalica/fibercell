import {Task} from './Task'
import {cellDecorator, cellDecoratorState} from '../cellDecorator'
import {isPromise, setFunctionName} from '../utils'
import {Cell} from '../Cell'

export class QueueStatus {
    size: number = 0
    error: Error | void = undefined
    errors: Error[] | void = undefined

    constructor(
        protected readonly parent: Queue
    ) {}

    get pending(): boolean {
        return this.size > 0
    }

    destructor() {
        this.parent.destructor()
    }

    retry() {
        this.parent.retry()
    }

    abort() {
        this.parent.abort()
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
        public readonly type: QueueType,
        public readonly displayName: string,
        protected readonly parentQueue?: Queue,
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
        if (this.slaves) this.slaves = this.slaves.filter(s => s !== slave)
        this.changed()
    }

    create<Method extends ActionMethod>(method: Method, t: Object = null): Method {
        return ((...args: any[]) => {
            const binded = method.bind(t, ...args)
            setFunctionName(binded, method.name)
            this.run(binded)
        }) as Method
    }

    run(handler: () => void) {
        const tasks = this.tasks || (this.tasks = [])
        if (tasks.length > 0 && this.type === QueueType.SINGLE) {
            const lastTask = tasks.pop()
            lastTask.destructor()
        }
        const task = new Task(
            `${this.displayName}.run(${handler.name})`,
            this,
            handler,
        )
        tasks.push(task)
        this.changed()
    }

    @cellDecorator protected get status(): QueueStatus {
        const tasks = this.tasks || (this.tasks = [])
        const status = new QueueStatus(this)
        if (this.type !== QueueType.PARALLEL && tasks.length > 0) {
            const task = tasks[0]
            const result = task.run()
            if (result instanceof Error) {
                status.error = result
                status.errors = [result]
            }
            if (isPromise(result)) status.size++
        } else {
            for (let task of tasks) {
                const result = task.run()
                if (isPromise(result)) status.size++
                if (result instanceof Error) {
                    status.error = status.error || result
                    if (!status.errors) status.errors = []
                    status.errors.push(result)
                }
            }
        }

        if (!this.slaves) return status

        for (let slave of this.slaves) {
            status.size += slave.status.size
            if (slave.status.error && !status.error) status.error = slave.status.error
            if (slave.status.errors) {
                status.errors = [...status.errors || [], ...slave.status.errors]
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

    protected changed() {
        cellDecoratorState.returnCell = true
        const cell: Cell<any> = this.status as any
        cellDecoratorState.returnCell = false
        cell.retry()
    }

    retry(target?: Task) {
        if (target) {
            target.reset()
        } else if (this.tasks) {
            for (let task of this.tasks) task.reset()
        }
        this.changed()
    }

    abort(target?: Task) {
        if (!this.tasks) return

        if (target) {
            this.tasks = this.tasks.filter(t => t !== target)
            target.destructor()
        } else {
            for (let task of this.tasks) task.destructor()
            this.tasks = []
        }
        this.changed()
    }

    destructor() {
        this.parentQueue.removeSlave(this)
        if (this.slaves) for (let slave of this.slaves) slave.destructor()
        this.slaves = undefined

        if (this.tasks) for (let task of this.tasks) task.destructor()
        this.tasks = undefined
    }
}
