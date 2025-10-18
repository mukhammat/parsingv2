import type { InferResultType } from '../../database/index.js'

type EngineType = InferResultType<'engines'>

export type CreateDto = Omit<EngineType, 'id'>