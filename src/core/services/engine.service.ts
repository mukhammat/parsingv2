import { schema, type DrizzleClient } from "../../database/index.js";
import type { CreateDto } from '../dto/engine.dto.js'

export class EngineService {
    constructor(private db: DrizzleClient) {}

    async create(data: CreateDto) {
        const r = await this.db
        .insert(schema.engines)
        .values(data);

        return Number(r.lastInsertRowid)
    }

    async addPerformance(engineId: number, performanceId: number) {
        await this.db.insert(schema.enginePerformances).values({
            engineId,
            performanceId
        })
    }
}