import {mem, action} from 'fibercell'
import {LocationStore} from './LocationStore'

export interface Page {
    id: string
    title: string
}

export class PageRepository {
    pages: Page[]

    constructor(
        protected _: {
            locationStore: LocationStore,
            pages: Page[]
        }
    ) {
        this.pages = _.pages
    }

    @action setPageId(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault()
        const id = (e.target as any).dataset.id
        this.page = id
    }

    @action getPageUrl(page: string): string {
        return this._.locationStore.toUrl({page})
    }

    @mem get page(): Page {
        return this._.locationStore.value('page') || this.pages[0]
    }

    set page(page: Page) {
        if (!page) throw new Error(
            `Provide data-id attribute for ${String(this)}.setPageId`
        )

        this._.locationStore.value('page', page.id)
    }
}
