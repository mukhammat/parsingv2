import { parsingWithoutSaveHelper } from './helpers/parsing.helper.js'
import { bootstrap } from './bootstrap.js'

// Закрыт для разработки

// https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/
// https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/
// https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/
export async function oil(url: string) {
  const $ = await parsingWithoutSaveHelper(
    url
  );

  
  type DataType = {
   performance: string[],
   api?: string,
   sae?: string,
   type?: string,
   name?: string,
  }

  const data: DataType = {
    performance: []
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

  console.log(data)

  const oilId = await bootstrap.oilService.create({
    name: data.name,
    sae: data.sae || '',
    type: data.type || '',
    brand: data.name,
  });

  for (const el of data.performance) {
    console.log(el)
    const id = await bootstrap.performanceService.getOrCreate(el);
    console.log(id)
    await bootstrap.oilService.addPerformance(oilId, id)
  }

  return data;
}