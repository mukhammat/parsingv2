import { smartDelay } from './helpers/delay.helper.js'
import { bootstrap } from './bootstrap.js'
import axios from 'axios';

const DATABASE_HOST = 'http://localhost:1337'
let w = 0;

async function savePerformances(performances: string[]) {
  const performancesSet = new Set<string>();

  for(const e of performances) {
    let res = await axios.get(`${DATABASE_HOST}/api/performances?filters[code][$eq]=${e}`);
    
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
  }

  return Array.from(performancesSet);
}

async function saveCarInProdDb() {
  w++;
  if(w === 2) {
    return;
  }

  const carsSiteUrl = 'https://podbor.ravenol.ru';

  // Получения отпарсинных машин
  const cs = await bootstrap.parsing.carParsing.cars();

  console.log(`Найдено ${cs.length} моделей\n`);
  let index = 0;

  for (const el of cs) {
    try {
      console.log('Машина', el);
      const res = await axios.post(`${DATABASE_HOST}/api/cars`, {
        data: {
          image_url: el.image,
          brand: el.brand,
          model: el.model,
          title: `${el.brand} ${el.model}`
        }
      })
      console.log('! Создана');
      
      // carId из ответа на создания
      const carId: number = res.data.data.documentId;
      console.log('CarId', carId);

      index++;
      console.log(`🚗 [${index}/${cs.length}] ${el.model}`);

      // задержка перед запросом страницы модели
      await smartDelay(1);

      const engineInfoWithCommonInfo = await bootstrap.parsing.carParsing.carInfo(
        `${carsSiteUrl}${el.url}`
      );

      for (const info of engineInfoWithCommonInfo) {
        // задержка перед запросом конкретного мотора
        await smartDelay(1.2);

        const d = await bootstrap.parsing.carParsing.motorInfo(
          `${carsSiteUrl}${info.link}`
        );

        let a: string;
        let res;

        // Получение или создание двигателя
        res = await axios.get(`${DATABASE_HOST}/api/engines?filters[title][$eq]=${info.type}`);

        if(!res.data.data.length) {
          res = await axios.post(`${DATABASE_HOST}/api/engines`, {
            data: {
              title: info.type,
              fuel_type: d.fuelType === 'Бензин' ? 'bz' : 'dz',
              //cars: [carId]
            }
          });
          a = res.data.data.documentId;
        } else {
          a = res.data.data[0].documentId;
        }

  

        const performancesId = await savePerformances(d.performances);

        console.log(`⚙️  Двигатель: ${info.type} - ${performancesId.length} performances`);

        try {
          console.log('a')
          await axios.put(`${DATABASE_HOST}/api/engines/${a}`, {
            data: {
              performances: performancesId,
              cars: [carId]
            }
          });
        } catch (err) {
          if(err instanceof Error) {
            console.log(err.message) 
          }
        }
      }
    } catch (error) {
      //@ts-ignore
      console.log(error.message)
    }
  }

  console.log('\n✅ Парсинг завершён');
}

async function saveOilInProdDb(url: string) {
  const data = await bootstrap.parsing.oilParsing.oil(url)

  console.log(data)
  const res = await axios.post(`${DATABASE_HOST}/api/oils`, {
    data: {
      title: data.name,
      url: data.url,
      image_url: data.image_url,
    }
  });

  const oilId = res.data.data.documentId
  console.log(oilId);
  const performancesId = await savePerformances(data.performance);

  try {
    await axios.put(`${DATABASE_HOST}/api/oils/${oilId}`, {
      data: {
        performances: performancesId
      }
    });
  } catch (err) {
    if(err instanceof Error) {
      console.log(err.message) 
    }
  }

  return data;
}




export async function api() {
  //await saveCarInProdDb();
  await saveOilInProdDb('https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-0w-40-sn-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-5w-50-sn-cf-fully-synthetic/')
  await saveOilInProdDb('https://bravoil.ae/product/evo-10w-60-sn-cf-fully-synthetic/')
}