import {action, Queue, mem, ActionId} from 'fibercell'
import {Todo, ITodoRepository} from './Todo'
import {LocationStore, Deps, Omit} from '../../common'

export enum TODO_FILTER {
    ALL = 'all',
    COMPLETE = 'complete',
    ACTIVE = 'active',
}

export class TodoRepository implements ITodoRepository {
    constructor(
        protected props: {
            id: string
            _: {
                fetch: <V>(url: string, init?: RequestInit) => V
                locationStore: LocationStore
            } & Omit<Deps<typeof Todo>, 'todoRepository'>
        }
    ) {}

    protected _ = {
        ...this.props._,
        todoRepository: this as TodoRepository
    }

    toString() { return this.props.id }

    @mem protected get todos(): Todo[] {
        const {_} = this
        mem.suggest([
            new Todo({
                title: 'mock-todo',
                completed: true,
                _
            })
        ])

        const todos = (this._.fetch('/api/todos') as Partial<Todo>[])
            .map(data => new Todo({...data, created: new Date(data.created), _}))

        return todos
    }

    protected set todos(data: Todo[]) {}

    reload() { mem.retry(this.todos) }

    get filter(): TODO_FILTER {
        return this._.locationStore.value('todo_filter') || TODO_FILTER.ALL
    }

    set filter(filter: TODO_FILTER) {
        this._.locationStore.value('todo_filter', filter)
    }

    @mem get filteredTodos(): Todo[] {
        const todos = this.todos
        switch (this.filter) {
            case TODO_FILTER.ALL:
                return todos
            case TODO_FILTER.COMPLETE:
                return todos.filter(todo => !!todo.completed)
            case TODO_FILTER.ACTIVE:
                return todos.filter(todo => !todo.completed)
        }
    }

    @mem get activeTodoCount(): number {
        return this.todos.reduce(
            (sum: number, todo: Todo) => sum + (todo.completed ? 0 : 1),
            0
        )
    }

    get completedCount(): number {
        return this.todos.length - this.activeTodoCount
    }

    @mem protected get actions() {
        return new Queue(`${this}.actions`)
    }

    protected actionDisabled(action?: ActionId | ActionId[] | void): boolean {
        return this.actions.find(action).pending
    }

    @action create(todoData: Partial<Todo> | Todo) {
        const todo = new Todo({...todoData, _: this._})
        if (!(todoData instanceof Todo)) {
            todo.create()
            return
        }

        this.todos = [...this.todos, todo]
        this.actions.run(() => {
            const resp: {id: string, created: string} = this._.fetch('/api/todo', {
                method: 'PUT',
                body: JSON.stringify(todo)
            })
            this.todos = this.todos.map(t => t.id === todo.id
                ? todo.copy({
                    ...resp,
                    created: new Date(resp.created)
                })
                : t
            )
        })
    }

    updateDisabled(todo: Todo): boolean {
        return this.actionDisabled([
            todo.remove,
            todo.create,
            this.toggleAll,
            this.completeAll,
            this.clearCompleted,
        ])
    }

    updating(todo: Todo): boolean {
        return this.actionDisabled(todo.update)
    }

    @action update(todo: Todo) {
        this.actions.find(todo.update).abort()
        const newTodos = this.todos.map(t => t.id === todo.id ? todo : t)
        this.todos = newTodos
        this.actions.run(() => {
            this._.fetch(`/api/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify(todo)
            })
        })
    }

    removeDisabled(todo: Todo): boolean {
        return this.updateDisabled(todo)
    }

    @action remove(todo: Todo) {
        this.actions.find(todo.update).abort()
        this.actions.run(() => {
            this.actions.find([
                this.toggleAll,
                this.completeAll,
                this.clearCompleted,
            ]).wait()
            this._.fetch(`/api/todo/${todo.id}`, {method: 'DELETE'})
            this.todos = this.todos.filter(t => t.id !== todo.id)
        })
    }

    protected patch(patches: [string, Partial<Todo>][]) {
        this._.fetch('/api/todos', {method: 'PUT', body: JSON.stringify(patches)})
        const patchMap = new Map(patches)
        const newTodos = this.todos.map(todo => todo.copy(patchMap.get(todo.id)))
        this.todos = newTodos
    }

    get toggleAllDisabled(): boolean {
        return this.actionDisabled([
            this.toggleAll,
            this.completeAll,
            this.clearCompleted,
        ])
    }

    @action toggleAll() {
        this.actions.run(() => {
            this.actions.find([this.create, this.update, this.remove]).wait()
            const todos = this.todos
            const completed = !!todos.find(todo => !todo.completed)
            const patches = todos.map(todo => ([todo.id, {completed}] as [string, Partial<Todo>]))
            this.patch(patches)
        })
    }

    get completeAllDisabled(): boolean {
        return this.toggleAllDisabled
    }

    @action completeAll() {
        this.actions.run(() => {
            this.actions.find([this.create, this.update, this.remove]).wait()
            const incomplete = this.todos.filter(t => !t.completed)
            const patches = incomplete.map(todo => (
                [todo.id, {completed: true}] as [string, Partial<Todo>]
            ))
            this.patch(patches)
        })
    }

    get clearCompletedDisabled(): boolean {
        return this.toggleAllDisabled
    }

    @action clearCompleted() {
        this.actions.run(() => {
            // const actions = this.todos.reduce((acc, todo) => [...acc, todo.create, todo.update, todo.remove], [] as ActionId[])
            this.actions.find([this.create, this.update, this.remove]).wait()
            const delIds = this.todos
                .filter(todo => todo.completed)
                .map(todo => todo.id)

            this._.fetch('/api/todos', {
                method: 'DELETE',
                body: JSON.stringify(delIds)
            })

            const delSet = new Set(delIds)
            this.todos = this.todos.filter(todo => !delSet.has(todo.id))
        })
    }
}
