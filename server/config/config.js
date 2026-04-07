module.exports = {
  secretKey: process.env.JWT_SECRET,
  jwtIssuer: process.env.JWT_ISSUER || 'defi-property',
  jwtAudience: process.env.JWT_AUDIENCE || 'defi-property-api',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  localDB: 'mongodb://localhost/realestatedb',
  publicKey: 'aHR0cHM6Ly9hcGkubnBvaW50LmlvL2VmMjg3NWY3MGU1OWUzMTkxODlk'
}
