'use strict';

/** Génère un numéro de compte unique BK + 14 chiffres */
const generateAccountNumber = () => {
  const ts  = Date.now().toString().slice(-8);
  const rnd = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `BK${ts}${rnd}`;
};

/** Génère une référence de transaction */
const generateTransactionRef = () => {
  const ts  = Date.now().toString();
  const rnd = Math.floor(Math.random() * 10_000).toString().padStart(4, '0');
  return `TXN${ts}${rnd}`;
};

/** Génère un IBAN tunisien simplifié */
const generateIBAN = (accountNumber) => {
  const digits = accountNumber.replace(/\D/g, '').slice(0, 13).padStart(13, '0');
  return `TN5910006001${digits}`;
};

/** Pagination helper */
const getPagination = (page, limit) => ({
  offset: (Math.max(1, parseInt(page)) - 1) * parseInt(limit),
  limit:  parseInt(limit),
});

/** Wrapper réponse paginée */
const paginatedResponse = (data, total, page, limit) => ({
  data,
  pagination: {
    total:   parseInt(total),
    page:    parseInt(page),
    limit:   parseInt(limit),
    pages:   Math.ceil(total / limit),
    hasNext: parseInt(page) * parseInt(limit) < parseInt(total),
    hasPrev: parseInt(page) > 1,
  },
});

/** Enlève les champs sensibles d'un utilisateur */
const sanitizeUser = (user) => {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, two_factor_secret, failed_login_attempts, locked_until, ...safe } = user;
  return safe;
};

module.exports = {
  generateAccountNumber,
  generateTransactionRef,
  generateIBAN,
  getPagination,
  paginatedResponse,
  sanitizeUser,
};
