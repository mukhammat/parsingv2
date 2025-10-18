import { schema, type DrizzleClient } from '../../database/index.js'
import type { CreateDto } from '../dto/car.dto.js'

export class CarService {
    constructor(private db: DrizzleClient) {}

    async create(data: CreateDto) {
        const res = await this.db.insert(schema.cars).values(data)
        return Number(res.lastInsertRowid)
    }

    async addEngine(carId: number, engineId: number) {
        const res = await this.db.insert(schema.carEngines)
        .values({
            engineId,
            carId
        });

        return Number(res.lastInsertRowid)
    }
}