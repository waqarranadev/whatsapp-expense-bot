/** Mongoose validator: amounts are whole rupees and must be > 0. */
export const positiveWholeAmount = {
  validator: (value: number): boolean => Number.isInteger(value) && value > 0,
  message: 'amount must be a whole number greater than 0',
};
