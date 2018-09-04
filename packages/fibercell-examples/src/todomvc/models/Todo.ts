// @flow
import {mem, action} from 'fibercell'
import {uuid} from '../../common'

export interface ITodoRepository {
    update(todo: Todo): void
    remove(todo: Todo): void
    actionDisabled(action: Function | symbol): boolean
}

export interface ITodo {
    readonly id: string
    readonly title: string
    readonly completed: boolean
    readonly created: Date
}

export interface ITodoInfo {
    id: string
    description: string
}

export interface TodoContext {
    todoRepository: ITodoRepository
}

export class Todo implements ITodo {
    @mem id: string = uuid()
    readonly completed: boolean = false
    readonly title: string = ''
    readonly created = new Date()

    protected _: TodoContext

    constructor(props: Partial<Todo> & {_: TodoContext}) {
        Object.assign(this, props)

        // Hide context from JSON.stringify
        Object.defineProperties(this, {
            _: {value: props._, enumerable: false}
        })
    }

    toString() {
        return `${this._.todoRepository}.${this.id}`
    }

    copy(data?: Partial<Todo> | void): Todo {
        return data
            ? new Todo({...this as Partial<Todo>, ...data, _: this._})
            : this
    }

    get updateDisabled() {
        return this._.todoRepository.actionDisabled(this.remove)
    }

    create = Symbol('create')

    @action update(data?: Partial<Todo>) {
        this._.todoRepository.update(this.copy(data))
    }

    get removeDisabled() {
        return this._.todoRepository.actionDisabled(this.create)
    }

    @action remove() {
        this._.todoRepository.remove(this)
    }
}
