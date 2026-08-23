function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function gazeDirection(cursor, bounds) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height * 0.42;
  const deltaX = cursor.x - centerX;
  const deltaY = cursor.y - centerY;
  const distance = Math.hypot(deltaX, deltaY);
  const degrees = normalizeDegrees(Math.atan2(deltaX, -deltaY) * 180 / Math.PI);
  return {
    index: Math.round(degrees / 22.5) % 16,
    degrees,
    distance,
    x: Math.max(-1, Math.min(1, deltaX / 500)),
    y: Math.max(-1, Math.min(1, deltaY / 500))
  };
}

module.exports = { gazeDirection, normalizeDegrees };
