import type { SkinId } from './skins';
import { getSkinById } from './skins';

export const OWNED_SKINS_KEY = 'checkers_owned_skins';
export const EQUIPPED_SKIN_KEY = 'checkers_equipped_skin';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function userKey(baseKey: string, userId?: string | null) {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

export function getOwnedSkins(userId?: string | null): SkinId[] {
  if (!canUseStorage()) return ['classic'];

  const key = userKey(OWNED_SKINS_KEY, userId);
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    window.localStorage.setItem(key, JSON.stringify(['classic']));
    return ['classic'];
  }

  try {
    const parsed = JSON.parse(rawValue);
    const owned = Array.isArray(parsed) ? parsed.filter((id): id is SkinId => getSkinById(id).id === id) : [];
    return Array.from(new Set<SkinId>(['classic', ...owned]));
  } catch {
    window.localStorage.setItem(key, JSON.stringify(['classic']));
    return ['classic'];
  }
}

export function saveOwnedSkins(skinIds: SkinId[], userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(userKey(OWNED_SKINS_KEY, userId), JSON.stringify(Array.from(new Set<SkinId>(['classic', ...skinIds]))));
}

export function addOwnedSkin(skinId: SkinId, userId?: string | null) {
  const ownedSkins = getOwnedSkins(userId);
  saveOwnedSkins([...ownedSkins, skinId], userId);
}

export function getEquippedSkin(userId?: string | null): SkinId {
  if (!canUseStorage()) return 'classic';

  const key = userKey(EQUIPPED_SKIN_KEY, userId);
  const equippedSkin = window.localStorage.getItem(key);
  const normalized = getSkinById(equippedSkin).id;
  const ownedSkins = getOwnedSkins(userId);

  if (!ownedSkins.includes(normalized)) {
    window.localStorage.setItem(key, 'classic');
    return 'classic';
  }

  return normalized;
}

export function equipSkin(skinId: SkinId, userId?: string | null) {
  if (!canUseStorage()) return;
  if (!getOwnedSkins(userId).includes(skinId)) return;
  window.localStorage.setItem(userKey(EQUIPPED_SKIN_KEY, userId), skinId);
}
