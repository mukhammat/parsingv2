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
    url?: string,
    image_url?: string
    }

    const data: DataType = {
      performance: [],
      url
    }

    data.name = $('div.page-title').children('h2').text()
    
    // Функция для проверки, является ли строка валидным SAE
    const isValidSaeFormat = (value: string): boolean => {
      if (!value) return false;
      const trimmed = value.trim();
      
      // Исключаем стандарты и спецификации (ASTM, ISO, MIL и т.д.)
      const excludedPatterns = [
        /^ASTM/i,
        /^ISO/i,
        /^MIL/i,
        /^SAE\s+J/i, // SAE J стандарты (не SAE вязкость)
        /^DOT/i,
        /^TYPE\s+D/i,
        /^GL-\d+/i,
        /^MT-\d+/i,
        /^C\d+/i,
        /^A\d+/i,
      ];
      
      if (excludedPatterns.some(pattern => pattern.test(trimmed))) {
        return false;
      }
      
      // Паттерн для SAE:
      // - Multi-grade: цифры + W + (опционально дефис) + цифры (например: "0W-16", "10W-40")
      // - Single-grade: только цифры (например: "50", "40") или "SAE 50"
      // - С W: цифры + W (например: "50W")
      const saePattern = /^(\d+W(-\d+)?|\d+W|\d+|SAE\s*\d+|SAE\s*\d+W(-\d+)?)$/i;
      return saePattern.test(trimmed);
    };

    // Функция для нормализации SAE (убирает "SAE " префикс)
    const normalizeSae = (value: string): string => {
      if (!value) return '';
      // Убираем префикс "SAE " если есть, оставляем формат как есть
      // (может быть "50", "50W", "10W-40" и т.д.)
      return value.trim().replace(/^SAE\s*/i, '');
    };

    // Функция для определения типа масла
    const isOilType = (value: string): boolean => {
      if (!value) return false;
      const lower = value.toLowerCase().trim().replace(/\n/g, ' ');
      const oilTypes = [
        'fully synthetic',
        'semi synthetic',
        'mineral',
        'oat',
        'c3',
        'c2/c3',
        'a3/b3',
        'a3/b4',
        'a3/b3 & a3/b4',
        'a5/b5'
      ];
      // Проверяем, содержит ли значение один из типов масла (не просто "meets or exceeds")
      return oilTypes.some(type => lower.includes(type));
    };

    // Обрабатываем только первый блок prod-info, чтобы избежать дублирования
    let processed = false;
    $('div.prod-info').each((_, el) => {
      // Если уже обработали один блок, выходим из цикла
      if (processed) return false;
      
      const p = $(el).find('p');
      const fields: { api?: string; sae?: string; type?: string } = {};
      const fieldIndices: { api?: number; sae?: number; type?: number } = {}; // Храним индексы для поиска соседних элементов
      
      // Парсим все поля
      p.each((index, elem) => {
        const text = $(elem).text();
        const parts = text.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          const value = parts.slice(1).join(':').trim();
          
          // Определяем поле по ключу или по содержимому
          if (key.includes('api') || key.includes('service category')) {
            fields.api = value;
            fieldIndices.api = index;
          } else if (key.includes('sae') || key.includes('viscosity')) {
            fields.sae = value;
            fieldIndices.sae = index;
          } else if (key.includes('type') || key.includes('synthetic') || key.includes('mineral')) {
            fields.type = value;
            fieldIndices.type = index;
          } else {
            // Если не можем определить по ключу, пробуем по содержимому
            if (isValidSaeFormat(value)) {
              fields.sae = value;
              fieldIndices.sae = index;
            } else if (isOilType(value)) {
              fields.type = value;
              fieldIndices.type = index;
            } else if (!fields.api && (value.includes('API') || value.includes('SN') || value.includes('SP') || value.includes('CF'))) {
              fields.api = value;
              fieldIndices.api = index;
            }
          }
        } else {
          // Если формат не "ключ: значение", пробуем найти в тексте
          const fullText = text.trim();
          if (isValidSaeFormat(fullText)) {
            fields.sae = fullText;
            fieldIndices.sae = index;
          } else if (isOilType(fullText)) {
            fields.type = fullText;
            fieldIndices.type = index;
          } else if (!fields.api && (fullText.includes('API') || fullText.match(/SN|SP|CF|SL|SM|SG|SJ|SF|CD|CI|CJ|CK|FA|GL|MT|DOT|TC/i))) {
            fields.api = fullText;
            fieldIndices.api = index;
          }
        }
      });

      // Если не нашли по ключам, пробуем старый способ (по позиции)
      if (!fields.api || !fields.sae || !fields.type) {
        p.each((index, elem) => {
          const text = $(elem).text();
          let value = '';
          
          // Пробуем разные форматы
          if (text.includes(':')) {
            value = text.split(':').slice(1).join(':').trim();
          } else {
            value = text.split('\n')[1] || text.trim();
          }
          
          if (!value) return;
          
          // Определяем поле по содержимому
          if (!fields.api && (value.includes('API') || value.match(/^(SN|SP|CF|SL|SM|SG|SJ|SF|CD|CI|CJ|CK|FA|GL|MT|DOT|TC)/i))) {
            fields.api = value;
            fieldIndices.api = index;
          } else if (!fields.sae && isValidSaeFormat(value)) {
            fields.sae = value;
            fieldIndices.sae = index;
          } else if (!fields.type && isOilType(value)) {
            fields.type = value;
            fieldIndices.type = index;
          } else if (!fields.sae && !fields.type) {
            // Если не определили, пробуем по позиции как fallback, но только если значение валидно
            if (index === 1 && !fields.sae && isValidSaeFormat(value)) {
              fields.sae = value;
              fieldIndices.sae = index;
            } else if (index === 2 && !fields.type && isOilType(value)) {
              fields.type = value;
              fieldIndices.type = index;
            }
          }
        });
      }

      // Проверяем и исправляем перепутанные поля
      // Случай 1: SAE содержит тип масла (например, "Fully Synthetic")
      if (fields.sae && isOilType(fields.sae)) {
        const saeIndex = fieldIndices.sae;
        const oilTypeValue = fields.sae; // Сохраняем исходное значение типа масла
        let foundValidSae = false;
        
        // Если знаем индекс SAE, проверяем соседние элементы (верхний и нижний)
        if (saeIndex !== undefined) {
          // Проверяем верхний элемент (index - 1)
          if (saeIndex > 0) {
            const upperElem = p.eq(saeIndex - 1);
            const upperText = upperElem.text();
            let upperValue = '';
            
            if (upperText.includes(':')) {
              upperValue = upperText.split(':').slice(1).join(':').trim();
            } else {
              upperValue = upperText.split('\n')[1] || upperText.trim();
            }
            
            if (upperValue && isValidSaeFormat(upperValue)) {
              // Нашли валидный SAE в верхнем элементе - меняем местами
              fields.sae = upperValue;
              fieldIndices.sae = saeIndex - 1;
              foundValidSae = true;
            }
          }
          
          // Если не нашли в верхнем, проверяем нижний элемент (index + 1)
          if (!foundValidSae && saeIndex < p.length - 1) {
            const lowerElem = p.eq(saeIndex + 1);
            const lowerText = lowerElem.text();
            let lowerValue = '';
            
            if (lowerText.includes(':')) {
              lowerValue = lowerText.split(':').slice(1).join(':').trim();
            } else {
              lowerValue = lowerText.split('\n')[1] || lowerText.trim();
            }
            
            if (lowerValue && isValidSaeFormat(lowerValue)) {
              // Нашли валидный SAE в нижнем элементе - меняем местами
              fields.sae = lowerValue;
              fieldIndices.sae = saeIndex + 1;
              foundValidSae = true;
            }
          }
        }
        
        // Если не нашли SAE в соседних элементах, ищем во всех элементах
        if (!foundValidSae) {
          p.each((index, elem) => {
            if (index === saeIndex) return; // Пропускаем текущий элемент
            
            const text = $(elem).text();
            let value = '';
            
            if (text.includes(':')) {
              value = text.split(':').slice(1).join(':').trim();
            } else {
              value = text.split('\n')[1] || text.trim();
            }
            
            if (value && isValidSaeFormat(value) && !foundValidSae) {
              fields.sae = value;
              fieldIndices.sae = index;
              foundValidSae = true;
            }
          });
        }
        
        // Переносим тип масла из SAE в type
        if (!fields.type || (fields.type && isValidSaeFormat(fields.type))) {
          fields.type = oilTypeValue; // Сохраняем тип масла, который был в SAE
        }
        
        // Если нашли валидный SAE, используем его, иначе очищаем
        if (!foundValidSae) {
          fields.sae = undefined;
        }
      }
      
      // Случай 2: Type содержит SAE (например, "10W-40")
      if (fields.type && isValidSaeFormat(fields.type)) {
        // Переносим значение из type в SAE, если SAE пустой
        if (!fields.sae) {
          fields.sae = fields.type;
          // Очищаем type, так как там был SAE, а не тип масла
          fields.type = undefined;
        } else {
          // Если SAE уже заполнен, просто очищаем type (так как там был SAE)
          fields.type = undefined;
        }
      }

      // Очищаем и нормализуем поле type
      if (fields.type) {
        let cleanType = fields.type.trim();
        // Убираем переносы строк и заменяем на пробелы
        cleanType = cleanType.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        // Убираем префиксы типа "Meets or Exceeds" и подобные
        cleanType = cleanType.replace(/^meets or exceeds\s*/i, '');
        // Если осталось только "Meets or Exceeds" или пусто, не устанавливаем тип
        if (cleanType && cleanType.toLowerCase() !== 'meets or exceeds') {
          data.type = cleanType;
        }
      }

      // Финальная проверка SAE перед присвоением
      if (fields.sae && !isValidSaeFormat(fields.sae)) {
        // Если SAE не валиден, очищаем его
        fields.sae = undefined;
      }

      // Присваиваем значения
      if (fields.api) data.api = fields.api;
      if (fields.sae) data.sae = normalizeSae(fields.sae);
      
      // Помечаем, что блок обработан, чтобы не обрабатывать другие блоки
      processed = true;
      return false; // Останавливаем цикл
    })

    $('div.prod-desc').each((_, el) => {
      const ul = $(el).find('ul');
      const li = $(ul[1]).find('li')

      $(li).each((_, el)=> {
        data.performance.push($(el).text())
      })
    })

    const a = $('div.woocommerce-product-gallery__image')
    .children('a')

  data.image_url = $(a[0]).attr('href')

    return data;
  }
}