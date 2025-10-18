import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

export const performances = table('performances', {
    id: t.integer().primaryKey(),
    code: t.text('code').unique().notNull()
})

export const oils = table('oils', {
    id: t.integer().primaryKey(),
    sae: t.text().notNull(),
    name: t.text().notNull().unique(),
    type: t.text().notNull(),
    brand: t.text(),
})

export const oilPerformances = table('oil_performances', {
  id: t.integer().primaryKey(),
  oilId: t.integer('oil_id').notNull().references(() => oils.id, { onDelete: 'cascade' }),
  performanceId: t.integer('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueOilPerformance: t.unique().on(table.oilId, table.performanceId)
}));


export const engines = table('engines', {
    id: t.integer().primaryKey(),
    type: t.text().notNull(), // Тип 1.0 2WD (CHZL/DKLA/DLAC) (95 л.с.) (70 кВт)	
    url: t.text().notNull(),
    version: t.text().notNull(), // Версия 2018 - по н.в.
    displacement: t.text(), // Обём двигатля
    fuelType: t.text('fuel_type'), // Топлива
})

export const enginePerformances = table('engine_performances', {
  id: t.integer().primaryKey(),
  engineId: t.integer('engine_id').notNull().references(() => engines.id, { onDelete: 'cascade' }),
  performanceId: t.integer('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
},
// (table) => ({
//   uniqueEnginePerformance: t.unique('unique_engine_performance').on(table.engineId, table.performanceId)
// })
);

export const cars = table('cars', {
    id: t.integer().primaryKey(),
    brand: t.text().notNull(),
    model: t.text().notNull(),
    image: t.text(),
})

export const carEngines = table("car_engines", {
  id: t.integer().primaryKey(),
  carId: t.integer('car_id').notNull().references(() => cars.id, { onDelete: 'cascade' }),
  engineId: t.integer('engine_id').notNull().references(() => engines.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueCarEngine: t.unique().on(table.carId, table.engineId)
}));