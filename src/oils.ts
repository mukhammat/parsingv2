import { parsingWithoutSaveHelper } from './helpers/parsing.helper.js'

export const p = async () => {
    const $ = await parsingWithoutSaveHelper('https://bravoil.ae/products/automotive-lubricants/automatic-transmission-fluid/');
    const oils = $('.list-wrap.row')

    oils.each((_, el) => {
        $(el).find('div.content_holder').each((_, el) => {
            const a = $(el).children('a').attr('href')
            console.log(`await saveOilInProdDb('${a}')`)
        })
    })
    
}
