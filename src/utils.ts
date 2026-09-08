export const camelToKebabCase = (str: string) => {
  return str
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, "$1-$2")
    .toLowerCase();
};
