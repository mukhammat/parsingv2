import { parsingWithoutSaveHelper } from '../helpers/parsing.helper.js'

// Закрыт для разработки

// https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/
// https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/
// https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/

export class OilParsing {
  async oil(url: string) {
    const $ = await parsingWithoutSaveHelper(
      url
    );

    
    type DataType = {
    performance: string[],
    api?: string,
    sae?: string,
    type?: string,
    name?: string,
    url?: string
    }

    const data: DataType = {
      performance: [],
      url
    }

    data.name = $('div.page-title').children('h2').text()
    
    $('div.prod-info').each((_, el) => {
      const p = $(el).find('p');
      data.api = $(p[0]).text().split('\n')[1]
      data.sae = $(p[1]).text().split(': ')[1]
      data.type = $(p[2]).text().split(': ')[1]
    })

    $('div.prod-desc').each((_, el) => {
      const ul = $(el).find('ul');
      const li = $(ul[1]).find('li')

      $(li).each((_, el)=> {
        data.performance.push($(el).text())
      })
    })

    return data;
  }
}