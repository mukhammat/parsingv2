import { parsingHelper, parsingWithoutSaveHelper } from './helpers/parsing.helper.js'
import { bootstrap } from './bootstrap.js'
import { oil } from './oil.js';

// 🔧 Базовая задержка (в миллисекундах)
const DELAY_BASE = 5000;

// простая функция задержки
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// функция с рандомом вокруг DELAY_BASE
const smartDelay = async (multiplier = 1) => {
  const random = DELAY_BASE * (0.8 + Math.random() * 0.4); // ±20%
  await delay(random * multiplier);
};

async function cars(url?: string) {
  type CarInfoType = {
    image?: string,
    model?: string,
    url?: string
  }

  const result: CarInfoType[] = [];

    const $ = url
    ? await parsingWithoutSaveHelper(url)
    : await parsingHelper(
        'https://podbor.ravenol.ru/1-cars/36-audi/#shopgroup_80',
        'cars.html'
      )

  $(".rav_model_item.searchobject").each((_, el) => {
    const image = $(el).children('a').find('img').attr('src');
    const model = $(el).children('a')
      .children('span.rav_item_title.rav-item-title')
      .text().replace(/\s+/g, ' ').trim();
    const url = $(el).children('a').attr('href');
    result.push({ image, model, url });
  });

  return result;
}

async function carInfo(url?: string) {
  const $ = url
    ? await parsingWithoutSaveHelper(url)
    : await parsingHelper(
        'https://podbor.ravenol.ru/1-cars/36-audi/8835-a1-gb/',
        'motors.html'
      )

  type ResultType = {
    type?: string
    production?: string 
    link?: string
  }

  const result: ResultType[] = [];

  $(".rav_types_content table tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    const type = $(tds[0]).text().trim();
    const production = $(tds[1]).text().trim();
    const link = $(tds[0]).find("a").attr("href");
    result.push({ type, production, link });
  });

  return result;
}

async function motorInfo(url?: string) {
  const $ = url
    ? await parsingWithoutSaveHelper(url)
    : await parsingHelper(
        'https://podbor.ravenol.ru/1-cars/36-audi/8835-a1-gb/200207-a1-10-tfsi-dlaa-110-ls-81-kvt/#mcontent',
        'moror_info.html'
      )

  type DataType = {
    marka?: string,
    model?: string,
    fuelType?: string,
    displacement?: string,
    version?: string,
    performances: string[]
  }

  const data: DataType = {
    performances: []
  }

  $('.rav_selection_head_title_top_title_col.col-lg-10.col-md-9.col-12').each((_, el) => {
    const as = $(el).find('a');
    const engine = $(as[2]).text();

    data.marka = $(as[0]).text();
    data.model = $(as[1]).text();
    data.displacement = engine.split(' ')[0];
  })

  $('.rav_selection_head_info_container').map((_, el) => {
    const as = $(el).find('p');
    const fuelType = $(as).find('strong');
    data.fuelType = $(fuelType[0]).text();
  })

  $('div.aggregate_node.active').each((_, el) => {
    const d = $(el).find('div.node_product_item_preview_text')[0];
    const a = $(d).find('a');

    $(a).each((_, el) => {
      data.performances?.push($(el).text().trim())
    })
  })

  return data;
}

async function saveInDb() {
  const carsSiteUrl = 'https://podbor.ravenol.ru';
  const cs = await cars();

  console.log(`Найдено ${cs.length} моделей\n`);
  let index = 0;

  for (const el of cs) {
    const carId = await bootstrap.carService.create({
      image: el.image || '',
      brand: el.model || '',
      model: el.model || '',
    })

    index++;
    console.log(`🚗 [${index}/${cs.length}] ${el.model}`);

    // задержка перед запросом страницы модели
    await smartDelay(1);

    const engineInfoWithCommonInfo = await carInfo(
      //`${carsSiteUrl}${el.url}`
    );


    for (const info of engineInfoWithCommonInfo) {
      try {
        // задержка перед запросом конкретного мотора
        await smartDelay(1.2);

        const d = await motorInfo(
          //`${carsSiteUrl}${info.link}`
        );


        const a = await bootstrap.engineService.create({
          type: info.type || '',
          version: info.type || '',
          displacement: d.displacement || '',
          url: info.link || '',
          fuelType: d.fuelType || ''
        })

        await bootstrap.carService.addEngine(carId, a);

        for(const e of d.performances) {
          const i = await bootstrap.performanceService.getOrCreate(e)
          try {
            await bootstrap.engineService.addPerformance(a, i)
          } catch (err) {
            console.log(err)
          }
        }
      } catch (err) {
        if(err instanceof Error)
          console.error(`Ошибка при парсинге ${info.link}:`, err.message);
      }
    }
  }

  console.log('\n✅ Парсинг завершён');
}

export async function api() {
  await saveInDb();
  // await oil('https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/')
  // await oil('https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/')
  // await oil('https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/')
}
