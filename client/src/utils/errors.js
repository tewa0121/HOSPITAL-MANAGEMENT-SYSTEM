export const errMsg = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || fallback;