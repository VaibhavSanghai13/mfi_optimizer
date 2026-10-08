import bcrypt from 'bcryptjs'

/** bcrypt work factor: 2^10 rounds — slow enough to resist guessing, fast enough for a login. */
const COST = 10

export const hashPassword = (password: string) => bcrypt.hash(password, COST)

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)
