export const USER_COLORS = [
  '#E06C75', '#61AFEF', '#98C379', '#E5C07B', '#C678DD',
  '#56B6C2', '#D19A66', '#7EC8E3', '#B392F0', '#F97583',
];

export function hashColor(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash) + clientId.charCodeAt(i);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
