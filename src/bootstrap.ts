import { db } from './database/index.js'
import { CarService } from './core/services/car.service.js'
import { OilService } from './core/services/oil.service.js'
import { PerformanceService } from './core/services/performance.service.js'
import { EngineService } from './core/services/engine.service.js'
import { CarParsing } from './parsings/car.parsing.js'
import { OilParsing } from './parsings/oil.parsing.js'

export const bootstrap = {
    service: {
        carService: new CarService(db),
        oilService: new OilService(db),
        performanceService: new PerformanceService(db),
        engineService: new EngineService(db),
    },
    parsing: {
        carParsing: new CarParsing(),
        oilParsing: new OilParsing()
    },
}