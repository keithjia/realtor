
module.exports = {
  getPagination: (query = {}, options = {}) => {
    const defaultLimit = options.defaultLimit || 20;
    const maxLimit = options.maxLimit || 100;
    const rawPage = parseInt(query.page, 10);
    const rawLimit = parseInt(query.limit, 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  },
  slugGenerator: async (title, fieldName, tableName) => {
    title = (title) ? title : 'Property listing';
    var slug = title.trim().toLowerCase().split(' ').join('-').replace(/[,"$!^@%*&]+/g, "");
    let table = require(`../models/${tableName}`);
    let incrementer = 0;
    if (table) {
      do {
        var result = await table.findOne({ slug: incrementer ? slug + '-' + incrementer : slug }).select('slug');

        if (result && result.slug)
          incrementer++;
        else
          return incrementer ? slug + '-' + incrementer : slug;
      } while (true)
    }
    else return Date.now();
  },
  isKeyMissing: (data, requiredArray) => {
    for (element of requiredArray) {
      if (!data[element]) {
        return element
      }
    }
    return false
  }
}
