import { smartDelay } from './helpers/delay.helper.js'
import { bootstrap } from './bootstrap.js'
import axios from 'axios';

// async function saveCarInDb() {
//   const carsSiteUrl = 'https://podbor.ravenol.ru';
//   const cs = await bootstrap.parsing.carParsing.cars();

//   console.log(`Найдено ${cs.length} моделей\n`);
//   let index = 0;

//   for (const el of cs) {
//     const carId = await bootstrap.service.carService.create({
//       image: el.image || '',
//       brand: el.brand || '',
//       model: el.model || '',
//     })

//     index++;
//     console.log(`🚗 [${index}/${cs.length}] ${el.model}`);

//     // задержка перед запросом страницы модели
//     await smartDelay(1);

//     const engineInfoWithCommonInfo = await bootstrap.parsing.carParsing.carInfo(
//       //`${carsSiteUrl}${el.url}`
//     );


//     for (const info of engineInfoWithCommonInfo) {
//       try {
//         // задержка перед запросом конкретного мотора
//         await smartDelay(1.2);

//         const d = await bootstrap.parsing.carParsing.motorInfo(
//           //`${carsSiteUrl}${info.link}`
//         );


//         const a = await bootstrap.service.engineService.create({
//           type: info.type || '',
//           version: info.production || '',
//           displacement: d.displacement || '',
//           fuelType: d.fuelType || ''
//         })


//         await bootstrap.service.carService.addEngine(carId, a);

//         for(const e of d.performances) {
//           const i = await bootstrap.service.performanceService.getOrCreate(e)
//           try {
//             await bootstrap.service.engineService.addPerformance(a, i)
//           } catch (err) {
//             console.log(err)
//           }
//         }
//       } catch (err) {
//         if(err instanceof Error)
//           console.error(`Ошибка при парсинге ${info.link}:`, err.message);
//       }
//     }
//   }

//   console.log('\n✅ Парсинг завершён');
// }

// async function saveOilInDb(url: string) {
//   const data = await bootstrap.parsing.oilParsing.oil(url)

//   const oilId = await bootstrap.service.oilService.create({
//     name: data.name || '',
//     sae: data.sae || '',
//     type: data.type || '',
//     url: data.url || '',
//   });

//   for (const el of data.performance) {
//     console.log(el)
//     const id = await bootstrap.service.performanceService.getOrCreate(el);
//     console.log(id)
//     await bootstrap.service.oilService.addPerformance(oilId, id)
//   }

//   return data;
// }

const DATABASE_HOST = 'http://localhost:1337'

async function saveCarInProdDb() {
  const carsSiteUrl = 'https://podbor.ravenol.ru';

  // Получения отпарсинных машин
  const cs = await bootstrap.parsing.carParsing.cars();

  console.log(`Найдено ${cs.length} моделей\n`);
  let index = 0;

  for (const el of cs) {
    // Создания машин в starpi
    const res = await axios.post(`${DATABASE_HOST}/api/cars`, {
      data: {
        image_url: el.image,
        brand: el.brand,
        model: el.model,
      }
    })
    
    // carId из ответа на создания
    const carId: number = res.data.data.id;
    console.log(carId)

    index++;
    console.log(`🚗 [${index}/${cs.length}] ${el.model}`);

    // задержка перед запросом страницы модели
    await smartDelay(1);

    const engineInfoWithCommonInfo = await bootstrap.parsing.carParsing.carInfo(
      //`${carsSiteUrl}${el.url}`
    );


    for (const info of engineInfoWithCommonInfo) {
      // задержка перед запросом конкретного мотора
      await smartDelay(1.2);

      const d = await bootstrap.parsing.carParsing.motorInfo(
        //`${carsSiteUrl}${info.link}`
      );

      let a: number;

      const res = 
      await axios.post(`${DATABASE_HOST}/api/engines`, {
        data: {
          title: info.type,
          fuel_type: d.fuelType === 'Бензин' ? 'bz' : 'dz',
          cars: [carId]
        }
      })

      a = res.data.data.id;

      for(const e of d.performances) {
        let i: number;
        const { data } = 
        await axios.get(`${DATABASE_HOST}/api/performances?filters[code][$eq]=${e}`)
        if(!data.length) {
          const { data } = await axios.post(`${DATABASE_HOST}/api/performances`, {
            data: {
              code: e
            }
          })
          i = data.id;
        } else {
          i = data.id
        }
        try {
          await axios.put(`${DATABASE_HOST}/api/engines/${a}`, {
            data: {
              performances: res.data.data.performances.push(i)
            }
          })
          await bootstrap.service.engineService.addPerformance(a, i)
        } catch (err) {
          console.log(err)
        }
      }
    }
  }

  console.log('\n✅ Парсинг завершён');
}

async function saveOilInProdDb(url: string) {
  const data = await bootstrap.parsing.oilParsing.oil(url)

  const oilId = await bootstrap.service.oilService.create({
    name: data.name || '',
    sae: data.sae || '',
    type: data.type || '',
    url: data.url || '',
  });

  for (const el of data.performance) {
    console.log(el)
    const id = await bootstrap.service.performanceService.getOrCreate(el);
    console.log(id)
    await bootstrap.service.oilService.addPerformance(oilId, id)
  }

  return data;
}

export async function api() {
  // await saveOilInDb('https://bravoil.ae/product/pro-drift-sn-cf-10w-60-fully-synthetic/')
  // await saveOilInDb('https://bravoil.ae/product/pro-pao-sn-0w-20-fully-synthetic/')
  // await saveOilInDb('https://bravoil.ae/product/pro-pao-c2-c3-sn-0w-30-fully-synthetic/')

  await saveCarInProdDb();
}
