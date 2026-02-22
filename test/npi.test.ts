import { describe, it, expect } from 'vitest'
import { validateNPI } from '../src/registry/npi.js'

describe('validateNPI', () => {
  // Known valid NPIs (CMS example and verified valid NPIs)
  it.each([
    '1234567893', // CMS standard example
    '1245319599', // Common test NPI
    '1114025228', // Verified valid NPI (check digit 8)
  ])('returns true for valid NPI "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(true)
  })

  // Invalid format
  it.each([
    '', // empty
    '12345', // too short
    '12345678901', // too long
    '123456789a', // non-numeric
    'abcdefghij', // all letters
    '123 456 789', // spaces
  ])('returns false for invalid format "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(false)
  })

  // Valid format but failing Luhn check
  it.each([
    '1234567890', // wrong check digit
    '1234567891', // wrong check digit
    '1234567892', // wrong check digit
    '1111111111', // all ones, wrong check digit
    '0000000000', // all zeros
  ])('returns false for NPI failing Luhn check "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(false)
  })
})
