// @flow
import {action} from 'fibercell'
import {uuid} from '../../common'

export interface ITodoRepository {
    update(todo: Todo): void
    remove(todo: Todo): void
    locked(todo?: Todo): boolean
}

export interface ITodo {
    id: string
    title: string
    completed: boolean
    created: Date
}

export interface ITodoInfo {
    id: string
    description: string
}

export class Todo implements ITodo {
    readonly id: string = uuid()
    readonly completed: boolean = false
    readonly title: string = ''
    readonly created = new Date()
    readonly removing: boolean

    protected store: ITodoRepository

    constructor(todo: Partial<Todo>, store: ITodoRepository) {
        Object.assign(this, todo)

        // Hide from JSON.stringify
        Object.defineProperties(this, {
            store: {value: store, enumerable: false},
            removing: {value: todo.removing || false, enumerable: false},
        })
    }

    copy(data?: Partial<Todo> | void): Todo {
        return data
            ? new Todo({...this as Partial<Todo>, ...data}, this.store)
            : this
    }

    get locked(): boolean {
        return this.store.locked(this)
    }

    @action update(data?: Partial<Todo>) {
        this.store.update(this.copy(data))
    }

    @action remove() {
        this.store.remove(this)
    }
}
