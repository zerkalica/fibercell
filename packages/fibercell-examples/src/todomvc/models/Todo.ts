import {action} from 'fibercell'
import { uuid } from '../../common';

export interface ITodoRepository {
    updating(todo: Todo): boolean
    updateDisabled(todo: Todo): boolean
    update(todo: Todo): void

    removeDisabled(todo: Todo): boolean
    remove(todo: Todo): void

    create(todo: Todo): void
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
    readonly id: string = uuid()
    readonly completed: boolean = false
    readonly title: string = ''
    readonly created: Date = new Date()

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
            ? new Todo({...this as Partial<Todo>, ...data, _: this._})
            : this
    }

    @action create() {
        this._.todoRepository.create(this)
    }

    get updateDisabled() {
        return this._.todoRepository.updateDisabled(this)
    }

    get updating() {
        return this._.todoRepository.updating(this)
    }

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
