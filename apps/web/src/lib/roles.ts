import { DICTIONARIES } from "@wreadt/core";

export const ROLES = DICTIONARIES.filter((d) => d.category === "role");
export const GENERAL_ROLE = "general";

/** 所选词库中的第一个职业词库，没有则为通用职场 */
export function defaultRole(dictIds: string[]): string {
  return dictIds.find((id) => ROLES.some((r) => r.id === id)) ?? GENERAL_ROLE;
}

export function roleText(id: string, generalText: string): string {
  const meta = ROLES.find((r) => r.id === id);
  return meta ? `${meta.name}：${meta.description}` : generalText;
}
