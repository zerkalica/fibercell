import {TodoRepository} from './models'
import * as React from 'react'

import {TodoItem} from './TodoItem'
import {sheet} from '../common'
import {observer} from 'mobx-react'

const css = sheet({
    main: {
        position: 'relative',
        zIndex: 2,
        borderTop: '1px solid #e6e6e6'
    },
    toggleAll: {
        outline: 'none',
        position: 'absolute',
        top: '-55px',
        left: '-12px',
        width: '60px',
        height: '34px',
        textAlign: 'center',
        border: 'none', /* Mobile Safari */
        $nest: {
            '&:before': {
                content: '\'❯\'',
                fontSize: '22px',
                color: '#e6e6e6',
                padding: '10px 27px 10px 27px'
            },
            '&:checked:before': {
                color: '#737373'
            }
        },
    },
    todoList: {
        margin: 0,
        padding: 0,
        listStyle: 'none'
    }
})

export interface TodoMainProps {
    id: string
    _: {
        todoRepository: TodoRepository
    }
}

export const TodoMain = observer(function TodoMain(
    {
        id,
        _: {
            todoRepository: {toggleAll, activeTodoCount, updating, clearing, filteredTodos},
        }
    }: TodoMainProps
) {
    if (!filteredTodos.length) return null

    return <section
        id={id}
        className={css.main}
    >
        <input
            id={`${id}-input`}
            className={css.toggleAll}
            disabled={updating || clearing}
            type="checkbox"
            onChange={toggleAll}
            checked={activeTodoCount === 0}
        />
        <ul
            className={css.todoList}
            id={`${id}-items`}
        >
            {filteredTodos.map(todo => <TodoItem
                id={`${id}-todo(${todo.id})`}
                key={todo.id}
                todo={todo}
            />)}
        </ul>
    </section>
})
