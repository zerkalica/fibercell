// @flow

import {action, mem} from 'fibercell'
import {Todo} from './models'
import {sheet, Sheet} from '../common'
import * as React from 'react'
import {observer} from 'mobx-react'

const ESCAPE_KEY = 27
const ENTER_KEY = 13

class TodoItemEdit {
    @mem todoBeingEditedId: string | void = null
    @mem editText: string = ''
    // @mem props: TodoItemProps
    constructor(
        protected props: TodoItemProps
    ) {}

    @action beginEdit() {
        if (this.todoBeingEditedId) return
        const {todo} = this.props
        this.todoBeingEditedId = todo.id
        this.editText = todo.title
    }

    @action setText({target}: React.KeyboardEvent<HTMLInputElement>) {
        this.editText = (target as any).value.trim()
    }

    @action.defer setEditInputRef(el: HTMLInputElement | void) {
        if (el) el.focus()
    }

    @action submit(event: React.FormEvent<HTMLInputElement>) {
        if (!this.todoBeingEditedId) return
        const title = this.editText.trim()
        const {todo} = this.props
        if (title) {
            if (todo.title !== title) {
                todo.update({title})
                this.editText = ''
            }
        } else {
            this.remove()
        }
        this.todoBeingEditedId = null
    }

    @action keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        switch (event.which) {
            case ESCAPE_KEY:
                this.editText = this.props.todo.title
                this.todoBeingEditedId = null
                break

            case ENTER_KEY:
                this.submit(event)
                break

            default: break
        }
    }

    @action toggle() {
        this.props.todo.toggle()
        this.todoBeingEditedId = null
    }

    @action remove() {
        this.props.todo.remove()
        this.todoBeingEditedId = null
    }
}

class TodoItemTheme {
    @mem get css() {
        const itemBase = {
            position: 'relative',
            fontSize: '24px',
            borderBottom: '1px solid #ededed',
            $nest: {
                '&:last-child': {
                    borderBottom: 'none'
                },
                '&:hover $destroy': {
                    display: 'block'
                }
            },
        } as Sheet

        const viewLabelBase = {
            wordBreak: 'break-all',
            padding: '15px 15px 15px 60px',
            display: 'block',
            lineHeight: '1.2',
            transition: 'color 0.4s'
        } as Sheet

        return sheet({
            regular: itemBase,
            completed: itemBase,

            editing: {
                borderBottom: 'none',
                padding: 0,
                $nest: {
                    '&:last-child': {
                        marginBottom: '-1px'
                    }
                }
            },

            edit: {
                backgroundColor: '#F2FFAB',
                display: 'block',
                zIndex: 0,
                border: 0,
                position: 'relative',
                fontSize: '24px',
                fontFamily: 'inherit',
                fontWeight: 'inherit',
                lineHeight: '1.4em',
                width: '406px',
                padding: '12px 16px',
                margin: '0 0 0 43px'
            },

            toggle: {
                textAlign: 'center',
                width: '40px',
                /* auto, since non-WebKit browsers doesn't support input styling */
                height: 'auto',
                position: 'absolute',
                top: 0,
                bottom: 0,
                margin: 'auto 0',
                border: 'none', /* Mobile Safari */
                '-webkit-appearance': 'none',
                appearance: 'none',
                opacity: 0,
                $nest: {
                    '&+label': {
                        /*
                            Firefox requires `#` to be escaped - https://bugzilla.mozilla.org/show_bug.cgi?id=922433
                            IE and Edge requires *everything* to be escaped to render, so we do that instead of just the `#` - https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/7157459/
                        */
                        backgroundImage: `url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23ededed%22%20stroke-width%3D%223%22/%3E%3C/svg%3E')`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center left'
                    },
    
                    '&:checked+label': {
                        backgroundImage: `url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23bddad5%22%20stroke-width%3D%223%22/%3E%3Cpath%20fill%3D%22%235dc2af%22%20d%3D%22M72%2025L42%2071%2027%2056l-4%204%2020%2020%2034-52z%22/%3E%3C/svg%3E')`
                    }
                },
            },

            viewLabelRegular: viewLabelBase,

            viewLabelCompleted: {
                ...viewLabelBase,
                color: '#d9d9d9',
                textDecoration: 'line-through'
            },

            viewLabelDisabled: {
                ...viewLabelBase,
                color: '#d9d9d9'
            },

            destroy: {
                padding: 0,
                border: 0,
                background: 'none',
                verticalAlign: 'baseline',
                display: 'none',
                position: 'absolute',
                right: '10px',
                top: 0,
                bottom: 0,
                width: '40px',
                height: '40px',
                fontSize: '30px',
                margin: 'auto 0',
                color: '#cc9a9a',
                marginBottom: '11px',
                transition: 'color 0.2s ease-out',
                $nest: {
                    '&:hover': {
                        color: '#af5b5e'
                    },
    
                    '&:after': {
                        content: '\'×\''
                    }
                },
            }
        })
    }

    label(isCompleted: boolean, isDisabled: boolean) {
        const css = this.css
        if (isDisabled) return css.viewLabelDisabled
        if (isCompleted) return css.viewLabelCompleted

        return css.viewLabelRegular
    }

    editable(isCompleted: boolean, isDirty: boolean) {
        const css = this.css
        if (isDirty) return css.viewLabelDisabled
        if (isCompleted) return css.completed

        return css.regular
    }
}

export interface TodoItemProps {
    readonly id: string
    readonly todo: Todo
}

@observer
export class TodoItem extends React.PureComponent<TodoItemProps> {
    protected todoItemEdit = new TodoItemEdit(this.props)
    protected theme = new TodoItemTheme()

    render() {
        const {
            todoItemEdit,
            theme,
            props: {
                id,
                todo
            },
        } = this
        const {css} = theme

        if (todoItemEdit.todoBeingEditedId === todo.id) {
            return <li
                id={id}
                className={css.editing}
            >
                <input
                    id={`${id}-editing`}
                    ref={todoItemEdit.setEditInputRef}
                    className={css.edit}
                    disabled={todo.saving}
                    value={todoItemEdit.editText}
                    onBlur={todoItemEdit.submit}
                    onInput={todoItemEdit.setText}
                    onKeyDown={todoItemEdit.keyDown}
                />
            </li>
        }

        return <li
            id={id}
            className={theme.editable(todo.completed, todo.dirty)}
        >
            <input
                id={`${id}-toggle`}
                className={css.toggle}
                type="checkbox"
                disabled={todo.saving}
                checked={todo.completed}
                onChange={todoItemEdit.toggle}
            />
            <label
                id={`${id}-beginEdit`}
                className={theme.label(todo.completed, todo.saving)}
                onDoubleClick={todoItemEdit.beginEdit}
            >
                {todo.title}
            </label>
            <button
                id={`${id}-destroy`}
                className={css.destroy}
                disabled={todo.removing}
                onClick={todoItemEdit.remove}
            />
        </li>
    }
}
