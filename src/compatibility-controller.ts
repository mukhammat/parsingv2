/**
 * A set of functions called "actions" for `compatibility`
 */
export default {
  oilsByEngine: async (ctx, next) => {
    try {
      const { id } = ctx.params;

      if (!id) {
        return ctx.badRequest('Engine id is required');
      }

      // Находим двигатель и его performance и SAE grades
      const engine = await strapi.db.query('api::engine.engine').findOne({
        where: { documentId: id },
        populate: ['performances', 'sae_grades'],
      });

      if (!engine) {
        return ctx.notFound('Engine not found');
      }

      const performanceIds = engine.performances?.map(p => p.documentId) || [];
      const saeGradeIds = engine.sae_grades?.map(s => s.documentId) || [];

      if (!performanceIds.length) {
        return ctx.body = [];
      }

      // Находим все масла, у которых есть эти performance
      const oils = await strapi.db.query('api::oil.oil').findMany({
        where: {
          performances: {
            documentId: { $in: performanceIds },
          },
        },
        populate: ['performances', 'sae_grade'],
      });

      // Фильтруем масла по SAE, если у двигателя есть SAE grades
      let filteredOils = oils;
      
      if (saeGradeIds.length > 0) {
        filteredOils = oils.filter(oil => {
          // Если у масла есть sae_grade и он есть в списке SAE двигателя
          if (oil.sae_grade && oil.sae_grade.documentId) {
            return saeGradeIds.includes(oil.sae_grade.documentId);
          }
          // Если у масла нет SAE, исключаем его
          return false;
        });
      }

      // Уникализируем по documentId
      const uniqueOilsMap = new Map();
      for (const oil of filteredOils) {
        uniqueOilsMap.set(oil.documentId, oil);
      }

      const uniqueOils = Array.from(uniqueOilsMap.values());

      ctx.body = uniqueOils.map(oil => ({
        id: oil.documentId,
        title: oil.title,
        image_url: oil.image_url,
        performances: oil.performances?.map(p => p.code) || [],
        sae_grade: oil.sae_grade?.title || null,
        description: oil.description,
        url: oil.url,
      }));

    } catch (err) {
      console.error('Error in oilsByEngine:', err);
      ctx.internalServerError('Unexpected error occurred');
    }
  },
};



