/**
 * Validate an NPI number using the Luhn check digit algorithm.
 *
 * NPI (National Provider Identifier) is a 10-digit number where the
 * last digit is a check digit calculated using the Luhn algorithm
 * with an implicit 80840 prefix (represented by adding constant 24).
 *
 * @param npi - The NPI string to validate
 * @returns true if the NPI is a valid 10-digit number passing the Luhn check
 *
 * @see https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand
 */
export function validateNPI(npi: string): boolean {
  // Step 1: Format validation -- exactly 10 digits
  if (!/^\d{10}$/.test(npi)) {
    return false
  }

  // Step 2: Luhn check with 80840 prefix (constant 24)
  let sum = 24 // accounts for the 80840 prefix
  const digits = npi.split('').map(Number)
  const checkDigit = digits[9]!

  // Process first 9 digits, starting from rightmost (index 8),
  // doubling every other digit starting from the rightmost
  for (let i = 8; i >= 0; i--) {
    let digit = digits[i]!
    // Double every other digit starting from the rightmost (index 8)
    if ((8 - i) % 2 === 0) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }

  // Step 3: Calculate expected check digit
  const expectedCheckDigit = (10 - (sum % 10)) % 10

  return checkDigit === expectedCheckDigit
}
