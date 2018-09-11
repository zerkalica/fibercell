import {action} from 'fibercell'

export interface ITodoRepository {
    updating(todo: Todo): boolean
    updateDisabled(todo: Todo): boolean
    update(todo: Todo): void
    removeDisabled(todo: Todo): boolean
    remove(todo: Todo): void
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
    readonly id: string
    readonly completed: boolean
    readonly title: string
    readonly created: Date

    protected _: TodoContext

    constructor(props: Partial<Todo> & {_: TodoContext}) {
        Object.assign(this, props)

        // Hide context from JSON.stringify
        Object.defineProperties(this, {
            _: {value: props._, enumerable: false}
        })
    }

    toString() {
        return `${this._.todoRepository}.todo(${this.id})`
    }

    copy(data?: Partial<Todo> | void): Todo {
        return data
            ? new Todo({...this as Partial<Todo>, ...data, create: this.create, _: this._})
            : this
    }

    get updateDisabled() {
        return this._.todoRepository.updateDisabled(this)
    }

    get updating() {
        return this._.todoRepository.updating(this)
    }

    create = Symbol('create')

    @action update(data?: Partial<Todo>) {
        this._.todoRepository.update(this.copy(data))
    }

    get removeDisabled() {
        return this._.todoRepository.removeDisabled(this)
    }

    @action remove() {
        this._.todoRepository.remove(this)
    }
}
