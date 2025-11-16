import { parsingHelper, parsingWithoutSaveHelper } from '../helpers/parsing.helper.js'

export type ResultType = {
  type?: string
  production?: string 
  link?: string
}

export class CarParsing {

  async cars(url?: string) {
    type CarInfoType = {
      image?: string,
      model?: string,
      url?: string,
      brand: string
    }

    const result: CarInfoType[] = [];

    const $ = url
      ? await parsingWithoutSaveHelper(url)
      : await parsingHelper(
          'https://podbor.ravenol.ru/1-cars/36-audi/#shopgroup_80',
          'cars.html'
        )

    const brand = $('a.ravwidg-list-link').html()!;

    $(".rav_model_item.searchobject").each((_, el) => {
      const image = $(el).children('a').find('img').attr('src');
      const model = $(el).children('a')
        .children('span.rav_item_title.rav-item-title')
        .text().replace(/\s+/g, ' ').trim();
      const url = $(el).children('a').attr('href');
      result.push({ image, model, url, brand });
    });

    return result;
  }

  async carInfo(url?: string) {
    const $ = url
      ? await parsingWithoutSaveHelper(url)
      : await parsingHelper(
          'https://podbor.ravenol.ru/1-cars/36-audi/8835-a1-gb/',
          'motors.html'
        )

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
}