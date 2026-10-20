// Мини-валидатор подмножества JSON Schema: type (строка или массив), required,
// properties, items, enum. Без зависимостей.
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function matches(type, v) {
  if (type === 'integer') return Number.isInteger(v);
  if (type === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === type;
}

export function validate(schema, data, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matches(t, data))) {
      errors.push(`${path}: expected ${types.join('|')}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.some((e) => e === data)) {
    errors.push(`${path}: expected one of ${schema.enum.join('|')}`);
  }
  if (typeOf(data) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in data) || data[key] === undefined) errors.push(`${path}.${key}: required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in data && data[key] !== undefined) errors.push(...validate(sub, data[key], `${path}.${key}`));
    }
  }
  if (Array.isArray(data) && schema.items) {
    data.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  return errors;
}
