import {Queue, mem, QueueType} from 'fibercell'
import {Todo, ITodoRepository} from './Todo'
import {LocationStore} from '../../common/LocationStore'

const todoAction = mem.action((t: TodoRepository) => t.actions)

export enum TODO_FILTER {
    ALL = 'all',
    COMPLETE = 'complete',
    ACTIVE = 'active',
}

export class TodoRepository implements ITodoRepository {
    constructor(
        protected _: {
            fetch: <V>(url: string, init?: RequestInit) => V
            locationStore: LocationStore
        }
    ) {}

    @mem get todos(): Todo[] {
        mem.suggest([
            new Todo({
                title: 'mock-todo',
                completed: true,
            }, this)
        ])

        return (this._.fetch('/todos') as Partial<Todo>[])
            .map(data => new Todo(data, this))
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

    actions = new Queue(QueueType.SERIAL, 'TodoRepository')

    get adding(): boolean {
        return this.actions.status.pending
    }

    @todoAction add(todoData: Partial<Todo>) {
        const todo = new Todo(todoData, this)
        this.todos = [...this.todos, todo]
        try {
            const id: string = this._.fetch('/todos', {
                method: 'PUT',
                body: JSON.stringify(todo)
            })

            this.todos = this.todos.map(t => t.id === todo.id ? t.copy({id, dirty: false}) : t)
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.filter(t => t.id !== todo.id)
            })
        }
    }

    get patching(): boolean {
        return this.actions.status.pending
    }

    get updating(): boolean {
        return this.actions.status.pending
    }

    get clearing(): boolean {
        return this.actions.status.pending
    }

    protected patch(patches: [string, Partial<Todo>][]) {
        this._.fetch('/todos', {method: 'PUT', body: JSON.stringify(patches)})
        const patchMap = new Map(patches)
        this.todos = this.todos.map(todo => todo.copy(patchMap.get(todo.id)))
    }

    @todoAction toggleAll() {
        const todos = this.todos
        const completed = !!todos.find(todo => !todo.completed)
        const patches = todos.map(todo => ([todo.id, {completed}] as [string, Partial<Todo>]))
        this.patch(patches)
    }

    @todoAction completeAll() {
        const incomplete = this.todos.filter(t => !t.completed)
        const patches = incomplete.map(todo => (
            [todo.id, {completed: true}] as [string, Partial<Todo>]
        ))
        this.patch(patches)
    }

    @todoAction clearCompleted() {
        const delIds = this.todos
            .filter(todo => todo.completed)
            .map(todo => todo.id)

        this._.fetch('/todos', {
            method: 'DELETE',
            body: JSON.stringify(delIds)
        })

        const delSet = new Set(delIds)
        this.todos = this.todos.filter(todo => !delSet.has(todo.id))
    }

    @todoAction update(todo: Todo) {
        const oldTodo = this.todos.find(t => t.id === todo.id)
        this.todos = this.todos.map(t => t.id === todo.id
            ? todo.copy({dirty: true})
            : t
        )
        try {
            this._.fetch(`/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify(todo)
            })
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.map(t => t.id === oldTodo.id ? oldTodo : t)
            })
        }
        this.todos = this.todos.map(t => t.id === todo.id
            ? todo.copy({dirty: false})
            : t
        )
    }

    @todoAction remove(todo: Todo) {
        this.todos = this.todos.map(t => t.id === todo.id
            ? todo.copy({dirty: true})
            : t
        )
        try {
            this._.fetch(`/todo/${todo.id}`, {method: 'DELETE'})
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.map(t => t.id === todo.id ? todo : t)
            })
        }
        this.todos = this.todos.filter(t => t.id !== todo.id)    
    }
}
