import type { CommunityType } from '../../graphql/generated/graphql';

export const COMMUNITY_TYPE_LABEL: Record<CommunityType, string> = {
  APARTMENT: 'Apartment community',
  RESIDENTIAL: 'Residential community',
  OTHER: 'Community',
};

export function formatHomes(count: number): string {
  return `${count.toLocaleString()} occupied ${count === 1 ? 'home' : 'homes'}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Koramangala, Bengaluru": the name, plus the locality when the name does not already say it. */
export function formatPlace(name: string, locality: string | null | undefined): string {
  return locality && !name.toLocaleLowerCase().includes(locality.toLocaleLowerCase())
    ? `${name}, ${locality}`
    : name;
}
