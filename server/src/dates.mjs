export const dayOf = (epochSeconds) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);
export const monthOf = (epochSeconds) => dayOf(epochSeconds).slice(0, 7);
