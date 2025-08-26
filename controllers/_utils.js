// تحويل BigInt لقابلية JSON
function toJSON(data) {
  return JSON.parse(
    JSON.stringify(data, (k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

// جلب معرف المستخدم من التوكن (يدعم id أو uid)
function getUid(req) {
  const id = req?.user?.uid ?? req?.user?.id;
  if (!id) return 0n;
  try {
    return BigInt(id);
  } catch {
    return BigInt(parseInt(id, 10) || 0);
  }
}

module.exports = { toJSON, getUid };
