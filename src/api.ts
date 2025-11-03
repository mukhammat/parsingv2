import { smartDelay } from './helpers/delay.helper.js'
import { bootstrap } from './bootstrap.js'
import axios from 'axios';
import type { TransmissionType, DataType, ResultType} from './parsings/car.parsing.js'

const DATABASE_HOST = 'http://localhost:1337'

async function saveSae(title: string) {
  let oilId: string;
  let res = await axios(`${DATABASE_HOST}/api/sae-grades?filters[title][$eq]=${encodeURIComponent(title)}`);

  if(res.data.data.length) {
    oilId = res.data.data[0].documentId;
  } else {
    res = await axios.post(`${DATABASE_HOST}/api/sae-grades`, {
      data: {
        title,
      }
    });
    oilId = res.data.data.documentId;
  }

  return oilId;
}

// ✅ Новая функция для сохранения массива SAE
async function saveSaeGrades(saeList: string[]): Promise<string[]> {
  // ✅ Если массив пустой, возвращаем пустой массив
  if (!saeList || saeList.length === 0) {
    return [];
  }
  
  const saeIds: string[] = [];
  
  for (const sae of saeList) {
    try {
      const saeId = await saveSae(sae);
      saeIds.push(saeId);
    } catch (error) {
      console.error(`Error saving SAE "${sae}":`, error instanceof Error ? error.message : error);
    }
  }
  
  return saeIds;
}

async function saveEngineInfo(d: DataType, info: ResultType, carId: string) {  
  let a: string;
  let res;

  try {
    // Получение или создание двигателя
    res = await axios.get(`${DATABASE_HOST}/api/engines?filters[title][$eq]=${encodeURIComponent(info.type!)}`);

    if(!res.data.data.length) {
      res = await axios.post(`${DATABASE_HOST}/api/engines`, {
        data: {
          title: info.type,
          fuel_type: d.fuelType === 'Бензин' ? 'bz' : 'dz',
        }
      });
      a = res.data.data.documentId;
    } else {
      a = res.data.data[0].documentId;
    }

    const performancesId = await savePerformances(d.performances);
    const saeIds = await saveSaeGrades(d.sae);

    console.log(`⚙️  Двигатель: ${info.type} - ${performancesId.length} performances, ${saeIds.length} SAE`);

    // ✅ Формируем данные для обновления
    const updateData: any = {
      performances: performancesId,
      cars: [carId]
    };

    // ✅ Добавляем SAE только если они есть
    if (saeIds.length > 0) {
      updateData.sae_grades = saeIds;
    }

    await axios.put(`${DATABASE_HOST}/api/engines/${a}`, {
      data: updateData
    });
    
    console.log(`✅ Двигатель "${info.type}" успешно сохранён`);
  } catch (err) {
    if(err instanceof Error) {
      console.error('❌ Error saving engine:', err.message);
      if (axios.isAxiosError(err) && err.response) {
        console.error('Response data:', JSON.stringify(err.response.data, null, 2));
      }
    }
  }
}

async function saveTransmissions(transmissions: TransmissionType[], carId: string) {
  try {
    for (const tr of transmissions) {
      let a: string;
      let res;

      try {
        // Получение или создание трансмиссии
        res = await axios.get(`${DATABASE_HOST}/api/transmissions?filters[title][$eq]=${encodeURIComponent(tr.title)}`);

        if(!res.data.data.length) {
          res = await axios.post(`${DATABASE_HOST}/api/transmissions`, {
            data: {
              title: tr.title,
            }
          });
          a = res.data.data.documentId;
        } else {
          a = res.data.data[0].documentId;
        }

        const performancesId = await savePerformances(tr.performances);
        const saeIds = await saveSaeGrades(tr.sae);

        console.log(`🔧 Трансмиссия: ${tr.title} - ${performancesId.length} performances, ${saeIds.length} SAE`);

        // ✅ Получаем существующие связи с машинами
        const existingTransmission = await axios.get(`${DATABASE_HOST}/api/transmissions/${a}?populate=cars`);
        const existingCars = existingTransmission.data.data.cars?.map((car: any) => car.documentId) || [];
        
        // ✅ Добавляем текущую машину, если её ещё нет
        const allCarIds = [...new Set([...existingCars, carId])];

        // ✅ Формируем данные для обновления
        const updateData: any = {
          performances: performancesId,
          cars: allCarIds
        };

        // ✅ Добавляем SAE только если они есть
        if (saeIds.length > 0) {
          updateData.sae_grades = saeIds;
        }

        await axios.put(`${DATABASE_HOST}/api/transmissions/${a}`, {
          data: updateData
        });
        
        console.log(`✅ Трансмиссия "${tr.title}" успешно обновлена`);
      } catch (err) {
        if(err instanceof Error) {
          console.error(`❌ Error saving transmission "${tr.title}":`, err.message);
          // ✅ Выводим полный ответ ошибки для отладки
          if (axios.isAxiosError(err) && err.response) {
            console.error('Response data:', JSON.stringify(err.response.data, null, 2));
          }
        }
      }
    }
  } catch (error) {
    if(error instanceof Error) {
      console.error('Error in saveTransmissions:', error.message);
    }
  }
}

async function savePerformances(performances: string[]) {
  const performancesSet = new Set<string>();

  for(const e of performances) {
    try {
      let res = await axios.get(`${DATABASE_HOST}/api/performances?filters[code][$eq]=${encodeURIComponent(e)}`);
      
      if(!res.data.data.length) {
        const { data: performanceData } = await axios.post(`${DATABASE_HOST}/api/performances`, {
          data: {
            code: e
          }
        });
        performancesSet.add(performanceData.data.documentId);
      } else {
        performancesSet.add(res.data.data[0].documentId);
      }
    } catch (error) {
      console.error(`Error saving performance "${e}":`, error instanceof Error ? error.message : error);
    }
  }

  return Array.from(performancesSet);
}

async function saveCarInProdDb() {
  const carsSiteUrl = 'https://podbor.ravenol.ru';

  try {
    // Получения отпарсинных машин
    const cs = await bootstrap.parsing.carParsing.cars();

    console.log(`Найдено ${cs.length} моделей\n`);
    let index = 0;

    for (const el of cs) {
      try {
        console.log('\n' + '='.repeat(60));
        console.log(`🚗 [${index + 1}/${cs.length}] ${el.brand} ${el.model}`);
        console.log('='.repeat(60));
        
        const res = await axios.post(`${DATABASE_HOST}/api/cars`, {
          data: {
            image_url: el.image,
            brand: el.brand,
            model: el.model,
            title: `${el.brand} ${el.model}`
          }
        });
        
        // carId из ответа на создания
        const carId: string = res.data.data.documentId;
        console.log(`✅ Машина создана, ID: ${carId}`);

        index++;

        // задержка перед запросом страницы модели
        await smartDelay(1);

        const engineInfoWithCommonInfo = await bootstrap.parsing.carParsing.carInfo(
          `${carsSiteUrl}${el.url}`
        );

        console.log(`\nНайдено ${engineInfoWithCommonInfo.length} вариантов двигателей\n`);

        for (const info of engineInfoWithCommonInfo) {
          // задержка перед запросом конкретного мотора
          await smartDelay(1.2);

          const d = await bootstrap.parsing.carParsing.motorInfo(
            `${carsSiteUrl}${info.link}`
          );

          await saveEngineInfo(d, info, carId);
          await saveTransmissions(d.transmission, carId);
          
          console.log(''); // Пустая строка для разделения
        }
      } catch (error) {
        if(error instanceof Error) {
          console.error(`\n❌ Error processing car ${el.brand} ${el.model}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Парсинг завершён');
    console.log('='.repeat(60));
  } catch (error) {
    if(error instanceof Error) {
      console.error('❌ Fatal error in saveCarInProdDb:', error.message);
    }
  }
}

// Функция для проверки валидности SAE формата
function isValidSae(sae: string): boolean {
  // Паттерн для валидного SAE: цифры + W + (опционально) дефис + цифры
  // Примеры: 0W-16, 0W-20, 10W-40, 70W и т.д.
  const saePattern = /^\d+W(-\d+)?$/;
  return saePattern.test(sae.trim());
}

async function saveOilInProdDb(url: string) {
  try {
    const data = await bootstrap.parsing.oilParsing.oil(url);

    console.log('Oil data:', data);
    
    const res = await axios.post(`${DATABASE_HOST}/api/oils`, {
      data: {
        title: data.name,
        url: data.url,
        image_url: data.image_url,
      }
    });

    const oilId = res.data.data.documentId;
    const performancesId = await savePerformances(data.performance);

    type D = {
      data: {
        performances: string[],
        sae_grade?: string
      }
    }
    const d: D = {
      data: {
        performances: performancesId,
      }
    }

    // Проверяем, что sae существует и соответствует валидному формату
    if(data.sae && isValidSae(data.sae)) {
      const saeId = await saveSae(data.sae);
      d.data.sae_grade = saeId
    }

    await axios.put(`${DATABASE_HOST}/api/oils/${oilId}`, d);
    
    console.log(`✅ Oil "${data.name}" saved successfully`);

    return data;
  } catch (err) {
    if(err instanceof Error) {
      console.error('❌ Error saving oil:', err.message);
      if (axios.isAxiosError(err) && err.response) {
        console.error('Response data:', JSON.stringify(err.response.data, null, 2));
      }
    }
    throw err;
  }
}

export async function api() {
  // Тестирование парсинга одного мотора
  // const a = await bootstrap.parsing.carParsing.motorInfo('https://podbor.ravenol.ru/1-cars/36-audi/87-100-s4/14211-100-2-0/')
  // console.log(JSON.stringify(a, null, 2));
  // Запуск полного парсинга машин
  //await saveCarInProdDb();
  
  // Примеры сохранения масел
  await saveOilInProdDb('https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-0w-40-sn-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-5w-50-sn-cf-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-10w-60-sn-cf-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ec-plus-sp-c3-0w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ec-sn-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ex-sn-plus-rc-sp-rc-5w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-energy-snrc-0w-16-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-c5-sn-0w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-rn17-fe-sn-0w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ls-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ms-sn-cf-rc-cf-5w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-c3-sn-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-eco-sn-cf-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-c1-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-fe-sp-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-ll-01-fe-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-gt1-sn-5w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-rn17-sn-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-opl-sn-sp-5w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-b71-2312-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-fe-sn-cf-5w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-standard-sn-cf-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/bravoil-neo-sn-cf-10w-40-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-c2-c3-sn-plus-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-pao-sn-cf-0w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-sn-cf-5w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-plus-sn-sl-cf-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-premium-sm-cf-10w-30-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-9000-sl-cf-10w-40-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-7000-sj-cf-15w-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-5000-sg-cf-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-3000-sf-cd-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/s-ultra-pace-sp-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-fa-4-fa-4-sn-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-extra-ck-4-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-extra-hd-ck-4-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-plus-cj-4-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-ht-plus-cj-4-ci-4-ci-4-15w-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-uhpd-cj-4-0w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-max-ci-4-plus-sl-10w-40-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-premium-ci-4-sl-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-hd-ci-4-sl-10w-40-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-le-ci-4-5w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-xhpd-ci-4-0w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-7000-cg-4-sj-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-5000-cf-4-sj-10w-30-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-3000-cf-sf-15w-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-1000-cd-sf-15w-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/synto-truck-standard-cc-sc-15w-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-synth-hd-sn-20w-50-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-plus-sn-5w-40-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-max-sm-10w-60-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-premium-sl-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-standard-sj-20w-60-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-ultra-sg-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-4t-classic-sf-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-super-sl-10w-40-semi-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/moto-2t-tc-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-xl-gl-5-75w-90-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-hd-gl-5-85w-140-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-ultra-gl-5-85w-90-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-hd-plus-gl-5-80w-140-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-g2-gl-5-75w-85-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-g3-gl-5-75w-140-fully-synhtetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-g5-gl-5-70w-80-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-sp-tl-521-45-gl-5-75w-90-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-lsd-gl-5-75w-140-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-fe-gl-4-75w-80-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-mtf-gl-4-gl-4-75w-90-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-2330-gl-4-75w-80-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-plus-gl-4-75w-80-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-extra-gl-4-85w-90-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-trans-gl-3-80w-90-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-pro-gl-1-sae-140-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-mt-mt-1-50-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/syngear-ep-75w-90-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-5-1-dot-5-1-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-4-dot-4-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-4-plus-dot-4-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-4-lv-dot-4-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-blue-dot-4-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/acto-3-dot-3-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-60/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-psi/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-g13/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-g12-2/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-g12/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-g11/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-lst-100/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-fl22/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-asia/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-lst-18-100/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-hoat/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-6277m/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-hybrid/')
  await saveOilInProdDb('https://bravoil.ae/product/subzero-type-d/')
  await saveOilInProdDb('https://bravoil.ae/product/switch-plus-cf-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/switch-premium-sm-20w-50-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/switch-la-40-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/agro-utto-gl-4-10w-30-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/agro-stou-cg-4-gl-4-20w-40-mineral/')




  // Kpp
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-dct-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-cvt-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-multi-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-d-vi-dexron-vi-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-atf4-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-d-iii-dexron-iiig-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-d-ii-dexron-iid-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-zfl-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-plus-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-chf-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-9g-tronic-fully-synthetic/')

  await saveOilInProdDb('https://bravoil.ae/product/synthpower-8hp-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-6hp-fully-synthetic/')

  await saveOilInProdDb('https://bravoil.ae/product/synthpower-lhm-plus-lhm-fluid-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-psf/')

  await saveOilInProdDb('https://bravoil.ae/product/synthpower-a-atf-type-a-mineral/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-to-4-hd-60-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/synthpower-hd-10w-mineral/')
}