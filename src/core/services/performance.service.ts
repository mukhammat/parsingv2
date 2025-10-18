import { and, eq, type Equal } from 'drizzle-orm';
import { schema, type DrizzleClient } from '../../database/index.js'

export class PerformanceService {
    constructor(private db: DrizzleClient) {}

    async create(code: string) {
        const [ p ] = await this.db.insert(schema.performances).values({
            code
        })
        .returning({
            id: schema.performances.id
        });
        
        return p.id;
    }

    async getAll() {
        const all = await this.db
        .select()
        .from(schema.performances)

        return all
    }

    async getOrCreate(code: string) {
        const [per] = await this.db
        .select()
        .from(schema.performances)
        .where(eq(schema.performances.code, code));

        let id = per?.id;

        if(!per) {
            id = await this.create(code);
        }


        return id;
    }
}