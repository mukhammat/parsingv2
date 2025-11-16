import { parsingHelper, parsingWithoutSaveHelper } from '../helpers/parsing.helper.js'

export type TransmissionType = {
  title: string,
  performances: string[],
  sae: string[], // ✅ Добавили SAE для трансмиссии
  api: string[], // API для трансмиссии
  acea: string[], // ACEA для трансмиссии
}

export type DataType = {
  model?: string,
  fuelType?: string,
  displacement?: string,
  version?: string,
  performances: string[],
  transmission: TransmissionType[],
  sae: string[], // SAE для двигателя
  api: string[], // API для двигателя
  acea: string[], // ACEA для двигателя
}

export class EngineParsing {
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
      sae: [],
      api: [],
      acea: []
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
    
    // ✅ Функция проверки уникальности для API и ACEA
    const isUnique = (value: string, list: string[]): boolean => {
      const normalized = value.trim();
      return normalized.length > 0 && !list.some(existing => existing.trim() === normalized);
    };
    
    // ✅ Шаг 2: Парсим SAE, API и ACEA для двигателей
    const uniqueEngineUrls = [...new Set(engineOilUrls)];
    
    // Функция для извлечения значений из текста (поддерживает запятые, точки с запятой и т.д.)
    // Извлекает ВСЕ значения, не только первое
    const extractValues = (text: string, label: string): string[] => {
      const values: string[] = [];
      
      if (!text || text.length === 0) {
        return values;
      }
      
      // Ищем все вхождения "Label: value" в тексте
      // Используем более простой паттерн, который найдет все вхождения
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escapedLabel}:\\s*([^\\n\\r]+)`, 'gi');
      const matches = Array.from(text.matchAll(regex));
      
      for (const match of matches) {
        if (match[1]) {
          const valueString = match[1].trim();
          
          if (valueString.length === 0) {
            continue;
          }
          
          // Разделяем значения по запятым и точкам с запятой
          const commaSeparated = valueString.split(/[,;]/).map(v => v.trim()).filter(v => v.length > 0);
          
          // Добавляем все найденные значения
          for (const value of commaSeparated) {
            // Если значение содержит пробелы, проверяем, не является ли это несколькими значениями
            // Например, "A3 B4" для ACEA или "SN Plus" для API
            if (value.includes(' ')) {
              // Для API: "SN Plus", "SP Plus" - это одно значение с пробелом
              // Для ACEA: "A3 B4" - это несколько значений через пробел
              if (label.toUpperCase() === 'ACEA' && value.match(/^[A-Z]\d+(\s+[A-Z]\d+)+$/i)) {
                // ACEA с несколькими значениями через пробел (например, "A3 B4")
                const spaceSeparated = value.split(/\s+/).filter(v => v.length > 0);
                values.push(...spaceSeparated);
              } else {
                // Одно значение с пробелом (например, "SN Plus" для API)
                values.push(value);
              }
            } else {
              // Одно значение без пробелов
              values.push(value);
            }
          }
        }
      }
      
      return values;
    };
    
    // ✅ Проходим по ВСЕМ маслам двигателя и извлекаем API и ACEA
    for (const oilUrl of uniqueEngineUrls) {
      try {
        const q = await parsingWithoutSaveHelper(oilUrl);
        
        // ✅ Способ 1: Ищем SAE в таблице атрибутов
        const attributesTable = q('div.product_tabs')
          .children('div.product_tab.product_tab_attributes');
        
        // Парсим SAE
        const saesFromTable = attributesTable.find('tr.fe_sae');
        let foundSae = false;
        
        saesFromTable.each((_, el) => {
          const sae = q(el).find('.value').text().trim();
          if (sae && sae.length > 0 && isSaeUnique(sae, data.sae)) {
            data.sae.push(sae);
            foundSae = true;
          }
        });
        
        // ✅ Парсим API и ACEA из product_top_attributes
        // Путь: maincontent -> content -> prod_card -> prod_card_top -> col-xl-8 -> product_tabs -> product_tab_main active -> product_top_attributes -> top_attr_section
        
        // Способ 1: Ищем в product_tab_main.active -> product_top_attributes
        let productTopAttributes = q('div.product_tabs')
          .find('div.product_tab.product_tab_main.active')
          .find('div.product_top_attributes');
        
        // Если не нашли с active, пробуем без active
        if (productTopAttributes.length === 0) {
          productTopAttributes = q('div.product_tabs')
            .find('div.product_tab.product_tab_main')
            .find('div.product_top_attributes');
        }
        
        // Если все еще не нашли, пробуем более широкий поиск
        if (productTopAttributes.length === 0) {
          productTopAttributes = q('div.product_top_attributes');
        }
        
        // Ищем все секции top_attr_section и обрабатываем каждую
        // Структура: div.top_attr_section > div.attr_name (содержит "API:" или "ACEA:") > div.attr_vals > div.attr_val > a (текст значения)
        productTopAttributes.find('div.top_attr_section').each((_, sectionEl) => {
          // Проверяем название атрибута
          const attrName = q(sectionEl).find('div.attr_name span').text().trim();
          
          // Если это секция API
          if (attrName.match(/^API:\s*$/i)) {
            // Находим все значения в div.attr_vals > div.attr_val
            q(sectionEl).find('div.attr_vals div.attr_val').each((_, valEl) => {
              // Извлекаем текст из ссылки или из самого div.attr_val
              const valueText = q(valEl).find('a').text().trim() || q(valEl).text().trim();
              if (valueText && isUnique(valueText, data.api)) {
                data.api.push(valueText);
              }
            });
          }
          
          // Если это секция ACEA
          if (attrName.match(/^ACEA:\s*$/i)) {
            // Находим все значения в div.attr_vals > div.attr_val
            q(sectionEl).find('div.attr_vals div.attr_val').each((_, valEl) => {
              // Извлекаем текст из ссылки или из самого div.attr_val
              const valueText = q(valEl).find('a').text().trim() || q(valEl).text().trim();
              if (valueText && isUnique(valueText, data.acea)) {
                data.acea.push(valueText);
              }
            });
          }
        });
        
        // Способ 2: Ищем напрямую по тексту в product_top_attributes
        const allTopAttributesText = productTopAttributes.text();
        if (allTopAttributesText) {
          // Ищем API
          const apiValues = extractValues(allTopAttributesText, 'API');
          for (const apiValue of apiValues) {
            if (isUnique(apiValue, data.api)) {
              data.api.push(apiValue);
            }
          }
          
          // Ищем ACEA
          const aceaValues = extractValues(allTopAttributesText, 'ACEA');
          for (const aceaValue of aceaValues) {
            if (isUnique(aceaValue, data.acea)) {
              data.acea.push(aceaValue);
            }
          }
        }
        
        // Способ 3: Ищем в product_tabs (более широкий поиск)
        const productTabsText = q('div.product_tabs').text();
        if (productTabsText) {
          const apiValues = extractValues(productTabsText, 'API');
          for (const apiValue of apiValues) {
            if (isUnique(apiValue, data.api)) {
              data.api.push(apiValue);
            }
          }
          
          const aceaValues = extractValues(productTabsText, 'ACEA');
          for (const aceaValue of aceaValues) {
            if (isUnique(aceaValue, data.acea)) {
              data.acea.push(aceaValue);
            }
          }
        }
        
        // Способ 4: Ищем в основном контенте страницы (последняя попытка)
        const mainContent = q('div.maincontent, div.content, div.prod_card').first();
        if (mainContent.length > 0) {
          const mainContentText = mainContent.text();
          const apiValues = extractValues(mainContentText, 'API');
          for (const apiValue of apiValues) {
            if (isUnique(apiValue, data.api)) {
              data.api.push(apiValue);
            }
          }
          
          const aceaValues = extractValues(mainContentText, 'ACEA');
          for (const aceaValue of aceaValues) {
            if (isUnique(aceaValue, data.acea)) {
              data.acea.push(aceaValue);
            }
          }
        }
        
        // Способ 5: Ищем API и ACEA в любом месте страницы (самый широкий поиск)
        // Это гарантирует, что мы найдем API и ACEA даже если структура страницы отличается
        const pageText = q('body').text();
        if (pageText) {
          const apiValues = extractValues(pageText, 'API');
          for (const apiValue of apiValues) {
            if (isUnique(apiValue, data.api)) {
              data.api.push(apiValue);
            }
          }
          
          const aceaValues = extractValues(pageText, 'ACEA');
          for (const aceaValue of aceaValues) {
            if (isUnique(aceaValue, data.acea)) {
              data.acea.push(aceaValue);
            }
          }
        }
        
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
    
    // ✅ Удаляем дубликаты API (оставляем уникальные)
    data.api = [...new Set(data.api.map(api => api.trim()).filter(api => api.length > 0))];
    
    // ✅ Удаляем дубликаты ACEA (оставляем уникальные)
    data.acea = [...new Set(data.acea.map(acea => acea.trim()).filter(acea => acea.length > 0))];

    // ✅ Шаг 3: Парсим SAE, API и ACEA для трансмиссий
    for (const [title, transData] of transmissionData.entries()) {
      const transmissionSae: string[] = [];
      const transmissionApi: string[] = [];
      const transmissionAcea: string[] = [];
      const uniqueTransUrls = [...new Set(transData.oilUrls)];

      for (const oilUrl of uniqueTransUrls) {
        try {
          const q = await parsingWithoutSaveHelper(oilUrl);
          
          // Парсим SAE
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
          
          // ✅ Парсим API и ACEA из product_top_attributes (аналогично двигателям)
          let productTopAttributes = q('div.product_tabs')
            .find('div.product_tab.product_tab_main.active')
            .find('div.product_top_attributes');
          
          // Если не нашли с active, пробуем без active
          if (productTopAttributes.length === 0) {
            productTopAttributes = q('div.product_tabs')
              .find('div.product_tab.product_tab_main')
              .find('div.product_top_attributes');
          }
          
          // Если все еще не нашли, пробуем более широкий поиск
          if (productTopAttributes.length === 0) {
            productTopAttributes = q('div.product_top_attributes');
          }
          
          // Ищем все секции top_attr_section и обрабатываем каждую
          productTopAttributes.find('div.top_attr_section').each((_, sectionEl) => {
            // Проверяем название атрибута
            const attrName = q(sectionEl).find('div.attr_name span').text().trim();
            
            // Если это секция API
            if (attrName.match(/^API:\s*$/i)) {
              // Находим все значения в div.attr_vals > div.attr_val
              q(sectionEl).find('div.attr_vals div.attr_val').each((_, valEl) => {
                // Извлекаем текст из ссылки или из самого div.attr_val
                const valueText = q(valEl).find('a').text().trim() || q(valEl).text().trim();
                if (valueText && isUnique(valueText, transmissionApi)) {
                  transmissionApi.push(valueText);
                }
              });
            }
            
            // Если это секция ACEA
            if (attrName.match(/^ACEA:\s*$/i)) {
              // Находим все значения в div.attr_vals > div.attr_val
              q(sectionEl).find('div.attr_vals div.attr_val').each((_, valEl) => {
                // Извлекаем текст из ссылки или из самого div.attr_val
                const valueText = q(valEl).find('a').text().trim() || q(valEl).text().trim();
                if (valueText && isUnique(valueText, transmissionAcea)) {
                  transmissionAcea.push(valueText);
                }
              });
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
      
      // ✅ Удаляем дубликаты API для трансмиссии (оставляем уникальные)
      const uniqueTransApiList = [...new Set(transmissionApi.map(api => api.trim()).filter(api => api.length > 0))];
      
      // ✅ Удаляем дубликаты ACEA для трансмиссии (оставляем уникальные)
      const uniqueTransAceaList = [...new Set(transmissionAcea.map(acea => acea.trim()).filter(acea => acea.length > 0))];

      data.transmission.push({
        title,
        performances: [...new Set(transData.performances)], // Убираем дубликаты
        sae: uniqueTransSaeList,
        api: uniqueTransApiList,
        acea: uniqueTransAceaList
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