/**
 * Changes a number by a random amount and returns it.
 *
 * @param num The number to spread
 * @param spread A number from 0 to 1 indicating the degree of spread allowed in +/- direction
 *
 * @returns The randomly change number
 */
export function useSpreadNum(num: number, spread = 0.2) {
  const spreadInt = Math.floor(num * spread);
  const variation = Math.floor(Math.random() * (spreadInt * 2)) - spreadInt;

  return num + variation;
}
