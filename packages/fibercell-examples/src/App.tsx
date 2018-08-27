import * as React from 'react'
import {TodoApp} from './todomvc'
import {sheet, PageRepository, Deps, LocationStore, Omit, Sheet} from './common'
import { fiberize, mem } from 'fibercell'
import { observer } from 'mobx-react'

class AppTheme {
    @mem get css() {
        const menuButton = {
            margin: 0,
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '5px',
            border: '1px solid #eee',
            background: 'none',
            lineHeight: '20px',
            textDecoration: 'none',
            cursor: 'pointer',
            $nest: {
                '&:hover': {
                    textDecoration: 'underline'
                }
            }
        } as Sheet

        return sheet({
            main: {
                display: 'flex',
                width: '100%',
                height: '100%',
                padding: '1em',
                font: '14px "Helvetica Neue", Helvetica, Arial, sans-serif',
                lineHeight: '1.4em',
                background: '#f5f5f5',
                color: '#4d4d4d',
                margin: '0 auto',
                fontWeight: 300,
            },

            menu: {},
            menuItem: {
                marginBottom: '0.3em',
                display: 'block'
            },
            menuButton: menuButton,
            menuButtonActive: {
                ...menuButton,
                background: '#ddd'
            },

            layout: {
                margin: '0 0 1em 1em'
            },
            apps: {
                padding: '1em',
                margin: '0 0 1em 1em'
            }
        })
    }
}

export interface AppProps {
    id: string
    _: Omit<Deps<typeof TodoApp>
        & Deps<typeof LocationStore>
        & {fetchFn: typeof fetch}, 'locationStore' | 'fetch'>
}

@observer
export class App extends React.PureComponent<AppProps> {
    protected locationStore = new LocationStore(this.props._, this.props.id)
    protected appTheme = new AppTheme()
    protected pageRepository = new PageRepository({
        locationStore: this.locationStore,
        pages: [
            {
                id: 'todomvc',
                title: 'Todo MVC'
            }
        ]
    })
    protected _ = {
        ...this.props._,
        locationStore: this.locationStore,
        fetch: fiberize(this.props._.fetchFn, r => r.json())
    }

    render() {
        const {
            _,
            appTheme: {css},
            pageRepository: {setPageId, getPageUrl, pages, page},
            props: {id}
        } = this

        const pageId = id + '-' + page.id

        return <div id={id} className={css.main}>
            <ul id={`${id}-menu`} className={css.menu}>
                {pages.map(item =>
                    <li
                        id={`${id}-item(${item.id})`}
                        key={item.id}
                        className={css.menuItem}
                    ><a
                        id={`${id}-itemlink(${item.id})`}
                        href={getPageUrl(item.id)}
                        className={page === item ? css.menuButtonActive : css.menuButton}
                        data-id={item.id}
                        onClick={setPageId}
                    >{item.id}</a></li>
                )}
            </ul>
            <div id={`${id}-apps`} className={css.apps}>
                <div id={`${id}-layout`} className={css.layout}>
                    <h1 id={`${id}-title`}>{page.title}</h1>
                    {page.id === 'todomvc' && <TodoApp id={pageId} _={_} />}
                </div>
            </div>
        </div>
    }
}
