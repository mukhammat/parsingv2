import type {InferResultType} from '../../database/index.js'

type OilType = InferResultType<'oils'>

export type CreateDto = Omit<OilType, 'id'>