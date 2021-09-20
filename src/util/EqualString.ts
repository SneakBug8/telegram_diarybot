export function StringIncludes(where: string, what: string) {
  return where.toLowerCase().includes(what.toLowerCase());
}

export function shortNum(num: number)
{
  return num.toFixed(2);
}