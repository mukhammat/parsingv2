// простая функция задержки
const DELAY_BASE = 5000;

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// функция с рандомом вокруг DELAY_BASE
export const smartDelay = async (multiplier = 1) => {
  const random = DELAY_BASE * (0.8 + Math.random() * 0.4); // ±20%
  await delay(random * multiplier);
};