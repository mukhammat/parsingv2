import { schema, type DrizzleClient } from '../../database/index.js'
import type { CreateDto } from '../dto/oil.dto.js'


export class OilService {
    constructor(private db: DrizzleClient) {}

    async create(data: CreateDto) {
        const result = await this.db.insert(schema.oils).values(data);
        const oilId = Number(result.lastInsertRowid);
        return oilId;
    }

    async addPerformance(oilId: number, performanceId: number) {
        await this.db.insert(schema.oilPerformances).values({
            oilId,
            performanceId
        })
    }
}