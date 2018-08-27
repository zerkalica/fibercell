// @flow
import {QueueStatus, Queue, mem, QueueType} from 'fibercell'

export interface ITodoRepository {
    update(todo: Todo): void
    remove(todo: Todo): void
    actions: Queue
}

export class Todo {
    id: string = `${Math.random()}.${Date.now()}.tmp`.substring(2)
    dirty: boolean = true
    completed: boolean = false
    title: string = ''

    protected store: ITodoRepository

    protected actions: Queue
    constructor(todo: Partial<Todo>, store: ITodoRepository) {
        // Hide from JSON.stringify
        Object.defineProperties(this, {
            store: {value: store},
            dirty: {value: todo.dirty || false, configurable: true},
            actions: {value: new Queue(QueueType.SERIAL, `Todo(${todo.id || this.id})`)}
        })
        Object.assign(this, todo)
    }

    copy(data?: Partial<Todo> | void): Todo {
        return data
            ? new Todo({...this as Partial<Todo>, ...data}, this.store)
            : this
    }

    protected get status(): QueueStatus {
        return this.store.actions.status
    }

    get saving(): boolean {
        return this.status.pending
    }

    get removing(): boolean {
        return this.status.pending
    }

    @mem.action update(data?: Partial<Todo>) {
        this.store.update(this.copy(data))
    }

    @mem.action remove() {
        this.store.remove(this)
    }

    @mem.action toggle() {
        this.update({completed: !this.completed})
    }
}
