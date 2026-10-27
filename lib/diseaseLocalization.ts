export function diseaseNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function translateDiseaseName(
  t: (key: string, params?: Record<string, string | number>) => string,
  name: string | null | undefined,
): string {
  if (!name) return '';
  const key = `diseases.names.${diseaseNameKey(name)}`;
  const translated = t(key);
  return translated === key ? name : translated;
}
