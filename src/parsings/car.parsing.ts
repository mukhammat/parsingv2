import { parsingHelper, parsingWithoutSaveHelper } from '../helpers/parsing.helper.js'

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

  async motorInfo(url?: string) {
    const $ = url
      ? await parsingWithoutSaveHelper(url)
      : await parsingHelper(
          'https://podbor.ravenol.ru/1-cars/36-audi/8835-a1-gb/200207-a1-10-tfsi-dlaa-110-ls-81-kvt/#mcontent',
          'moror_info.html'
        )

    type DataType = {
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
}