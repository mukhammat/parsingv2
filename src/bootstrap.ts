import { CarParsing } from './parsings/car.parsing.js'
import { EngineParsing } from './parsings/engine.parsing.js'
import { OilParsing } from './parsings/oil.parsing.js'

export const bootstrap = {
    parsing: {
        carParsing: new CarParsing(),
        oilParsing: new OilParsing(),
        engineParsing: new EngineParsing(),
    },
}