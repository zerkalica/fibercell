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

    @mem get todos(): Todo[] {
        const {_} = this
        mem.suggest([
            new Todo({
                title: 'mock-todo',
                completed: true,
                _
            })
        ])

        return (this._.fetch('/api/todos') as Partial<Todo>[])
            .map(data => new Todo({...data, _}))
    }

    set todos(data: Todo[]) {}

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

    @mem protected get queue() { return new Queue(`${this}.queue`) }

    actionDisabled(action?: ActionId | ActionId[] | void): boolean {
        return this.queue.find(action).pending
    }

    @action add(todoData: Partial<Todo>) {
        const todo = new Todo({...todoData, _: this._})
        this.todos = [...this.todos, todo]
        this.queue.run(() => {
            const {id}: {id: string} = this._.fetch('/api/todo', {
                method: 'PUT',
                body: JSON.stringify(todo)
            })
            todo.id = id
        }, todo.create)
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

    @action update(todo: Todo) {
        this.queue.find(todo.update).abort()
        this.queue.run(() => {
            this._.fetch(`/api/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify(todo)
            })
        })
    }

    removeDisabled(todo: Todo): boolean {
        return this.actionDisabled([
            todo.remove,
            todo.create
        ])
    }

    @action remove(todo: Todo) {
        this.queue.find(todo.update).abort()
        this.queue.run(() => {
            this.queue.find([
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
        this.todos = this.todos.map(todo => todo.copy(patchMap.get(todo.id)))
    }

    get toggleAllDisabled(): boolean {
        return this.actionDisabled([
            this.toggleAll,
            this.completeAll,
            this.clearCompleted,
        ])
    }

    @action toggleAll() {
        this.queue.run(() => {
            this.queue.find([this.add, this.update, this.remove]).wait()
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
        this.queue.run(() => {
            this.queue.find([this.add, this.update, this.remove]).wait()
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
        this.queue.run(() => {
            this.queue.find([this.add, this.update, this.remove]).wait()
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
