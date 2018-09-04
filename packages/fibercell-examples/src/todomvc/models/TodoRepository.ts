import {action, Queue, mem, Fiber} from 'fibercell'
import {Todo, ITodoRepository} from './Todo'
import {LocationStore} from '../../common'

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
        },
        public displayName: string
    ) {}

    toString() { return this.displayName }

    @mem get todos(): Todo[] {
        mem.suggest([
            new Todo({
                title: 'mock-todo',
                completed: true,
            }, this)
        ])

        return (this._.fetch('/api/todos') as Partial<Todo>[])
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

    private updateQueue = new Queue(`${this}.updateQueue`)

    @action locked(todo?: Todo): boolean {
        return this.updateQueue.locked(todo ? todo.id : this)
    }

    @action add(todoData: Partial<Todo>) {
        const todo = new Todo(todoData, this)
        this.updateQueue.run(todo.id, () => {
            const fiber: Fiber<Todo[]> = Fiber.create('add')
            this.todos = fiber.value() || fiber.value([...this.todos, todo])
            try {
                const {id}: {id: string} = this._.fetch('/api/todo', {
                    method: 'PUT',
                    body: JSON.stringify(todo)
                })

                this.todos = this.todos.map(t => t.id === todo.id ? t.copy({id}) : t)
            } catch (error) {
                mem.throwRollback(error, () => {
                    this.todos = this.todos.filter(t => t.id !== todo.id)
                })
            }
        })
    }

    @action update(todo: Todo) {
        this.todos = this.todos.map(t => t.id === todo.id ? todo : t)
        this.updateQueue.run(todo.id, () => {
            this._.fetch(`/api/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify(todo)
            })
        })
    }
/*
    @action update2(todo: Todo) {
        const task = this.updateQueue.run(todo.id, (task) => {
            this.todos = this.todos.map(t => t.id === todo.id ? todo.copy({task}) : t)
            this._.fetch(`/api/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify(todo)
            })
        })
    }
*/
    @action remove(todo: Todo) {
        this.updateQueue.run(todo.id, () => {
            this._.fetch(`/api/todo/${todo.id}`, {method: 'DELETE'})
            this.todos = this.todos.filter(t => t.id !== todo.id)
        })
    }

    protected patch(patches: [string, Partial<Todo>][]) {
        this._.fetch('/api/todos', {method: 'PUT', body: JSON.stringify(patches)})
        const patchMap = new Map(patches)
        this.todos = this.todos.map(todo => todo.copy(patchMap.get(todo.id)))
    }

    @action toggleAll() {
        this.updateQueue.run(this, () => {
            const todos = this.todos
            const completed = !!todos.find(todo => !todo.completed)
            const patches = todos.map(todo => ([todo.id, {completed}] as [string, Partial<Todo>]))
            this.patch(patches)
        })
    }

    @action completeAll() {
        this.updateQueue.run(this, () => {
            const incomplete = this.todos.filter(t => !t.completed)
            const patches = incomplete.map(todo => (
                [todo.id, {completed: true}] as [string, Partial<Todo>]
            ))
            this.patch(patches)
        })
    }

    @action clearCompleted() {
        this.updateQueue.run(this, () => {
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
