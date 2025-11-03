import { parsingHelper, parsingWithoutSaveHelper } from '../helpers/parsing.helper.js'

export type TransmissionType = {
  title: string,
  performances: string[],
  sae: string[], // ✅ Добавили SAE для трансмиссии
}

export type DataType = {
  model?: string,
  fuelType?: string,
  displacement?: string,
  version?: string,
  performances: string[],
  transmission: TransmissionType[],
  sae: string[], // SAE для двигателя
}

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

  async motorInfo(url?: string) {
    const $ = url
      ? await parsingWithoutSaveHelper(url)
      : await parsingHelper(
          'https://podbor.ravenol.ru/1-cars/36-audi/8835-a1-gb/200207-a1-10-tfsi-dlaa-110-ls-81-kvt/#mcontent',
          'moror_info.html'
        )

    const data: DataType = {
      performances: [],
      transmission: [],
      sae: []
    }

    const engineOilUrls: string[] = []
    const transmissionData: Map<string, { performances: string[], oilUrls: string[] }> = new Map()

    const normalizeCategory = (title: string) => {
      title = title.toLowerCase();
      if (title.includes('кпп') || title.includes('трансмис')) return 'gearbox';
      if (title.includes('двигат')) return 'engine';
      return 'other';
    };

    // ✅ Шаг 1: Собираем все данные синхронно
    $('div.aggregate_node').each((_, el) => {
      // Определяем категорию
      let category = 'other';
      $(el).find('div.node_product_item_preview_text').each((_, textEl) => {
        const cat = normalizeCategory($(textEl).text().trim());
        if (cat !== 'other') {
          category = cat;
        }
      });

      // ✅ Собираем ВСЕ URL масел из узла (может быть несколько продуктов в одном узле)
      const oilUrls: string[] = [];
      
      // Ищем все node_product_item в узле и собираем URL из каждого
      const productItems = $(el).find('div.node_product_item');
      
      productItems.each((idx, productEl) => {
        // Пробуем разные варианты селекторов для поиска ссылки на продукт
        const urlSelectors = [
          'div.node_product_item_title_wrapp h4 a',
          'div.node_product_item_title a',
          'h4 a',
          'a[href*="shop.ravenol"]',
          'a[href*="/product/"]'
        ];
        
        for (const selector of urlSelectors) {
          const url = $(productEl).find(selector).first().attr('href');
          if (url && url.trim()) {
            const fullUrl = url.startsWith('http') ? url : `https://shop.ravenol.su${url}`;
            if (!oilUrls.includes(fullUrl)) {
              oilUrls.push(fullUrl);
            }
            break; // Нашли URL для этого продукта, переходим к следующему
          }
        }
      });
      
      // Если не нашли через node_product_item, пробуем старый способ
      if (oilUrls.length === 0) {
        $(el).find('div.node_product_item_title_wrapp h4 a, div.node_product_item_title a, h4.node_product_item_title a').each((_, linkEl) => {
          const url = $(linkEl).attr('href');
          if (url && url.trim()) {
            const fullUrl = url.startsWith('http') ? url : `https://shop.ravenol.su${url}`;
            if (!oilUrls.includes(fullUrl)) {
              oilUrls.push(fullUrl);
            }
          }
        });
      }

      // Собираем performances для текущего узла
      const d = $(el).find('div.node_product_item_preview_text').first();
      const links = d.find('a');
      const currentPerformances: string[] = [];

      links.each((_, linkEl) => {
        const code = $(linkEl).text().trim();
        if (code) {
          currentPerformances.push(code);
          // ✅ Добавляем в общий список только уникальные
          if (!data.performances.includes(code)) {
            data.performances.push(code);
          }
        }
      });

      // ✅ Разделяем по категориям
      if (category === 'engine') {
        for (const oilUrl of oilUrls) {
          if (!oilUrl) continue;
          
          // ✅ Исключаем антифризы и другие не-масла
          const urlLower = oilUrl.toLowerCase();
          const isNotOil = urlLower.includes('antifriz') || 
                          urlLower.includes('antifreeze') || 
                          urlLower.includes('coolant') ||
                          urlLower.includes('охлажд') ||
                          urlLower.includes('promyvka') ||
                          urlLower.includes('промывк') ||
                          urlLower.includes('cleaner') ||
                          urlLower.includes('очист');
          
          if (!isNotOil) {
            engineOilUrls.push(oilUrl);
          }
        }
      } else if (category === 'gearbox') {
        // ✅ Очищаем заголовок от лишних символов
        const title = $(el).find('h4.aggregate_node_title')
          .text()
          .trim()
          .replace(/\s+/g, ' ');
        
        if (title) {
          if (!transmissionData.has(title)) {
            transmissionData.set(title, { performances: [], oilUrls: [] });
          }
          const transData = transmissionData.get(title)!;
          // ✅ Сохраняем performances из текущего узла
          transData.performances.push(...currentPerformances);
          // ✅ Добавляем все URL масел из узла
          for (const url of oilUrls) {
            if (url && !transData.oilUrls.includes(url)) {
              transData.oilUrls.push(url);
            }
          }
        }
      }
    });

    // ✅ Функция нормализации SAE (приведение к верхнему регистру W)
    const normalizeSae = (sae: string): string => {
      return sae.trim().replace(/w/g, 'W'); // Приводим 'w' к 'W'
    };
    
    // ✅ Функция проверки уникальности SAE (с учетом нормализации)
    const isSaeUnique = (sae: string, saeList: string[]): boolean => {
      const normalized = normalizeSae(sae);
      return !saeList.some(existing => normalizeSae(existing) === normalized);
    };
    
    // ✅ Шаг 2: Парсим SAE для двигателей
    const uniqueEngineUrls = [...new Set(engineOilUrls)];
    
    for (const oilUrl of uniqueEngineUrls) {
      try {
        const q = await parsingWithoutSaveHelper(oilUrl);
        
        // ✅ Способ 1: Ищем SAE в таблице атрибутов
        const saesFromTable = q('div.product_tabs')
          .children('div.product_tab.product_tab_attributes')
          .find('tr.fe_sae');
        
        let foundSae = false;
        
        saesFromTable.each((_, el) => {
          const sae = q(el).find('.value').text().trim();
          if (sae && sae.length > 0 && isSaeUnique(sae, data.sae)) {
            data.sae.push(sae);
            foundSae = true;
          }
        });
        
        // ✅ Способ 2: Если в таблице не нашли, ищем SAE в тексте страницы (например, в названии)
        if (!foundSae) {
          // Пробуем найти SAE в названии товара (формат типа "10W-40", "5W-30" и т.д.)
          const titleText = q('h1').text() || '';
          const saePattern = /\b(\d+W-\d+)\b/gi;
          const matches = titleText.match(saePattern);
          
          if (matches) {
            for (const match of matches) {
              const sae = match.trim();
              if (sae && isSaeUnique(sae, data.sae)) {
                data.sae.push(sae);
                foundSae = true;
              }
            }
          }
        }
        
        // ✅ Способ 3: Ищем в других местах на странице
        if (!foundSae) {
          // Ищем все вхождения SAE в тексте страницы
          const allText = q('body').text();
          const saePattern = /\b(\d+W-\d+)\b/gi;
          const allMatches = allText.match(saePattern);
          
          if (allMatches) {
            const uniqueMatches = [...new Set(allMatches)];
            for (const match of uniqueMatches) {
              const sae = match.trim();
              if (sae && isSaeUnique(sae, data.sae)) {
                data.sae.push(sae);
                foundSae = true;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error parsing engine oil ${oilUrl}:`, error);
      }
    }
    
    // ✅ Удаляем дубликаты SAE (нормализуем и оставляем уникальные)
    const normalizedSaeSet = new Set<string>();
    const uniqueSaeList: string[] = [];
    
    for (const sae of data.sae) {
      const normalized = normalizeSae(sae);
      if (!normalizedSaeSet.has(normalized)) {
        normalizedSaeSet.add(normalized);
        uniqueSaeList.push(normalized); // Сохраняем нормализованную версию
      }
    }
    
    data.sae = uniqueSaeList;

    // ✅ Шаг 3: Парсим SAE для трансмиссий
    for (const [title, transData] of transmissionData.entries()) {
      const transmissionSae: string[] = [];
      const uniqueTransUrls = [...new Set(transData.oilUrls)];

      for (const oilUrl of uniqueTransUrls) {
        try {
          const q = await parsingWithoutSaveHelper(oilUrl);
          const saes = q('div.product_tabs')
            .children('div.product_tab.product_tab_attributes')
            .find('tr.fe_sae');
          
          saes.each((_, el) => {
            const sae = q(el).find('.value').text().trim();
            if (sae && sae.length > 0) {
              // Проверяем уникальность с учетом нормализации
              const normalized = normalizeSae(sae);
              if (!transmissionSae.some(existing => normalizeSae(existing) === normalized)) {
                transmissionSae.push(sae);
              }
            }
          });
        } catch (error) {
          console.error(`Error parsing transmission oil ${oilUrl}:`, error);
        }
      }

      // ✅ Удаляем дубликаты SAE для трансмиссии (нормализуем и оставляем уникальные)
      const normalizedTransSaeSet = new Set<string>();
      const uniqueTransSaeList: string[] = [];
      
      for (const sae of transmissionSae) {
        const normalized = normalizeSae(sae);
        if (!normalizedTransSaeSet.has(normalized)) {
          normalizedTransSaeSet.add(normalized);
          uniqueTransSaeList.push(normalized); // Сохраняем нормализованную версию
        }
      }

      data.transmission.push({
        title,
        performances: [...new Set(transData.performances)], // Убираем дубликаты
        sae: uniqueTransSaeList
      });
    }

    // ✅ Шаг 4: Собираем метаданные
    $('.rav_selection_head_title_top_title_col.col-lg-10.col-md-9.col-12').each((_, el) => {
      const as = $(el).find('a');
      if (as.length >= 3 && as[2]) {
        const engine = $(as[2]).text();
        if (engine) {
          data.displacement = engine.split(' ')[0];
        }
      }
      if (as.length >= 2 && as[1]) {
        const model = $(as[1]).text();
        if (model) {
          data.model = model;
        }
      }
    });

    $('.rav_selection_head_info_container').each((_, el) => {
      const as = $(el).find('p');
      const fuelType = $(as).find('strong');
      if (fuelType.length > 0 && fuelType[0]) {
        const fuel = $(fuelType[0]).text();
        if (fuel) {
          data.fuelType = fuel;
        }
      }
    });

    return data;
  }
}