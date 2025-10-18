import type {InferResultType} from '../../database/index.js'

type CarType = InferResultType<'cars'>

export type CreateDto = Omit<CarType, 'id'>