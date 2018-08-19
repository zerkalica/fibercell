import {Queue, setupCellClass, fiberize, Fiber, mem, QueueType} from 'fibercell'
import {MobxCell} from 'fibercell-mobx'
import * as React from 'react'

setupCellClass(MobxCell)

const fetchJson = fiberize(fetch, r => r.json())

interface Todo {
    dirty: boolean
    id: string
    completed: boolean
    title: string
}

const todoAction = mem.action((t: TodoRepository) => t.actions)

class TodoRepository {
    @mem get todos(): Todo[] {
        mem.suggest([{
            id: '1',
            dirty: true,
            title: 'mock-todo',
            completed: true
        }])

        return fetchJson('/todos')
    }

    set todos(data: Todo[]) {}

    reload() { mem.retry(this.todos) }

    actions = new Queue(QueueType.SERIAL, 'todos')

    @todoAction completeAll() {
        const incomplete: Todo[] = this.todos.filter(t => !t.completed)
        const patch = incomplete.map(todo => (
            [todo.id, {completed: true}] as [string, Partial<Todo>]
        ))

        fetchJson('/todos', {method: 'POST', body: JSON.stringify(patch)})

        const map = new Map(patch)
        this.todos = this.todos.map(t =>
            map.has(t.id)
                ? {...t, ...map.get(t.id)}
                : t
        )
    }

    @todoAction add(todo: Todo) {
        this.todos = [...this.todos, todo]
        try {
            const id: string = fetchJson('/todos', {
                method: 'PUT',
                body: JSON.stringify({...todo, dirty: undefined})
            })

            this.todos = this.todos.map(t => t.id === todo.id ? {...todo, id, dirty: false} : t)    
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.filter(t => t.id !== todo.id)
            })
        }
    }

    @todoAction update(todo: Todo) {
        const oldTodo = this.todos.find(t => t.id === todo.id)
        this.todos = this.todos.map(t => t.id === todo.id
            ? {...todo, dirty: true}
            : t
        )
        try {
            fetchJson(`/todo/${todo.id}`, {
                method: 'POST',
                body: JSON.stringify({...todo, dirty: undefined})
            })
            this.todos = this.todos.map(t => t.id === todo.id
                ? {...todo, dirty: false}
                : t
            )
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.map(t => t.id === oldTodo.id ? oldTodo : t)
            })
        }
    }

    @todoAction remove(todo: Todo) {
        this.todos = this.todos.map(t => t.id === todo.id
            ? {...todo, dirty: true}
            : t
        )
        try {
            fetchJson(`/todo/${todo.id}`, {method: 'DELETE'})
            this.todos = this.todos.filter(t => t.id !== todo.id)    
        } catch (error) {
            mem.throwRollback(error, () => {
                this.todos = this.todos.map(t => t.id === todo.id ? todo : t)
            })
        }
    }
}

export function TodosView(
    {
        rep: {
            actions: {pending, size, error},
            todos,
            remove,
            update,
            add
        }
    }: {
        rep: TodoRepository
    }
) {
    try {
        return <div>
            Runned actions: {size}
            {error && <div>

            </div>}
            <button
                disabled={pending}
                onClick={() => add({dirty: true, id: ('' + Math.random()).substring(2), title: '123', completed: false})}
            >Add</button>
            <ul>
                {todos.map(todo =>
                    <li>
                        {todo.id} # {todo.title}
                        <button
                            disabled={pending}
                            onClick={() => update({...todo, title: todo.title + '-upd'})}
                        >Update</button>
                        <button
                            disabled={pending}
                            onClick={() => remove(todo)}
                        >Remove</button>
                    </li>
                )}
            </ul>
        </div>
    } catch (e) {
        const fiber = Fiber.from(e)
        if (!fiber) throw e

        return <div>
            {e instanceof Promise && <div>Loading...</div>}
            {e instanceof Error && <div>Error: {e.message}</div>}
            {e instanceof Error && <button onClick={() => fiber.retry()}>Retry</button>}
            {e instanceof Error && <button onClick={() => fiber.abort()}>Abort</button>}
        </div>
    }
}
